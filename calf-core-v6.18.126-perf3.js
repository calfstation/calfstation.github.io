
    (function () {
      function getCountByName(name) {
        const raw = document.getElementById('raw-category-counts');
        if (!raw) return 0;

        const links = raw.querySelectorAll('a');
        for (const a of links) {
          const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
          if (!text.includes(name)) continue;

          const match = text.match(/\((\d+)\)/);
          if (match) return match[1];
        }

        const allText = (raw.textContent || '').replace(/\s+/g, ' ');
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped + '\\s*\\((\\d+)\\)');
        const found = allText.match(regex);
        return found ? found[1] : 0;
      }

      const patch = document.getElementById('patch-count');
      const next = document.getElementById('next-count');
      const history = document.getElementById('history-count');

      if (patch) {
        patch.textContent =
          getCountByName('한글화') ||
          getCountByName('한글 패치');
      }
      if (next) next.textContent = getCountByName('NEXT');
      if (history) {
        history.textContent =
          getCountByName('프로젝트 히스토리');
      }
    })();

    (function () {
      const panel = document.getElementById('owner-admin-panel');
      if (!panel) return;

      function revealOwnerPanel() {
        panel.hidden = false;
        panel.classList.add('is-owner-visible');
      }

      function hasTistoryOwnerControls() {
        const controls = document.querySelectorAll(
          '.admin-tools a, a[href^="/manage/"], a[href="/manage"]'
        );

        return Array.from(controls).some(function (link) {
          return !panel.contains(link);
        });
      }

      if (hasTistoryOwnerControls()) {
        revealOwnerPanel();
        return;
      }

      fetch('/manage', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        redirect: 'follow',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
        .then(function (response) {
          if (!response.ok) return;

          const finalUrl = new URL(response.url || '/manage', location.href);
          const isSameOrigin = finalUrl.origin === location.origin;
          const isManagePage =
            finalUrl.pathname === '/manage' ||
            finalUrl.pathname.indexOf('/manage/') === 0;

          if (isSameOrigin && isManagePage) {
            revealOwnerPanel();
          }
        })
        .catch(function () {
          /* 로그아웃 또는 인증 리다이렉트: 숨김 상태 유지 */
        });
    })();

    (function () {
      /*
       * CALF STATION V6.18.82 · 검은 구독하기 버튼 전용 정상화
       * ------------------------------------------------------------
       * 이 블록만 교체합니다. 헤더/홈/NEXT/한글화/히스토리/방명록/
       * 모바일/애니메이션 등 다른 기능은 건드리지 않습니다.
       *
       * 기존 문제:
       * - 화면 전체의 button/a/[role=button]에서 '구독하기' 글자만 찾아
       *   대신 click()하는 방식이라, 티스토리 구조가 바뀌면 엉뚱한 요소를
       *   잡거나 새로고침처럼 보이는 무반응이 생길 수 있었습니다.
       *
       * V6.18.82:
       * 1) 로그아웃 상태는 Tistory가 제공하는 LOGIN_URL로 즉시 이동.
       * 2) 로그인 상태는 티스토리 공식 .btn_subscription[data-blog-id]
       *    버튼만 정확히 찾아 실행.
       * 3) 공식 버튼이 DOM에 아직 없으면 동일한 data-* 계약의 보이지 않는
       *    bridge 버튼을 잠깐 만들어 Tistory 공용 스크립트에 클릭을 전달.
       * 4) '구독중' 표시는 window.T.config.SUBSCRIPTION과 공식 버튼 상태에서
       *    읽습니다.
       */
      const proxy = document.getElementById('calf-subscribe-proxy');
      if (!proxy) return;

      let nativeButton = null;
      let bridgeButton = null;
      let tries = 0;
      let timer = 0;
      let syncing = false;

      function tistoryConfig() {
        return (
          window.T &&
          window.T.config &&
          typeof window.T.config === 'object'
        )
          ? window.T.config
          : null;
      }

      function currentBlogId() {
        const config = tistoryConfig();

        if (
          config &&
          config.BLOG &&
          config.BLOG.id !== undefined &&
          config.BLOG.id !== null
        ) {
          return String(config.BLOG.id);
        }

        const native = document.querySelector(
          '.btn_subscription[data-blog-id]'
        );

        return native
          ? String(native.getAttribute('data-blog-id') || '')
          : '';
      }

      function currentBlogUrl() {
        const config = tistoryConfig();

        if (config && config.DEFAULT_URL) {
          return String(config.DEFAULT_URL);
        }

        if (
          window.TistoryBlog &&
          window.TistoryBlog.url
        ) {
          return String(window.TistoryBlog.url);
        }

        return location.origin;
      }

      function isLoggedIn() {
        const config = tistoryConfig();

        if (
          config &&
          typeof config.IS_LOGIN === 'boolean'
        ) {
          return config.IS_LOGIN;
        }

        /*
         * T.config가 아직 준비되지 않은 아주 이른 순간에는
         * 로그인 여부를 섣불리 추정하지 않습니다.
         */
        return null;
      }

      function loginUrl() {
        const config = tistoryConfig();

        if (config && config.LOGIN_URL) {
          return String(config.LOGIN_URL);
        }

        return (
          'https://www.tistory.com/auth/login?redirectUrl=' +
          encodeURIComponent(location.href)
        );
      }

      function nativeSubscriptionConnected() {
        const config = tistoryConfig();
        const subscription =
          config && config.SUBSCRIPTION
            ? config.SUBSCRIPTION
            : null;

        if (!subscription) return false;

        return Boolean(
          subscription.isConnected === true ||
          subscription.status === 'connected' ||
          subscription.status === 'subscribed'
        );
      }

      function normalizedText(node) {
        return (node && node.textContent ? node.textContent : '')
          .replace(/\s+/g, ' ')
          .trim();
      }

      function findNativeSubscribeButton() {
        const blogId = currentBlogId();

        const candidates = Array.from(
          document.querySelectorAll(
            '.btn_subscription[data-blog-id]'
          )
        );

        return candidates.find(function (candidate) {
          if (!(candidate instanceof HTMLElement)) return false;
          if (candidate === proxy) return false;
          if (candidate.dataset.calfSubscribeBridge === '1') return false;

          if (!blogId) return true;

          return (
            String(
              candidate.getAttribute('data-blog-id') || ''
            ) === blogId
          );
        }) || null;
      }

      function nativeButtonLooksSubscribed(button) {
        if (!button) return false;

        const text = normalizedText(button);

        return (
          text.indexOf('구독중') !== -1 ||
          button.classList.contains('following') ||
          button.classList.contains('is-subscribed') ||
          button.getAttribute('aria-pressed') === 'true'
        );
      }

      function setProxyState(subscribed) {
        proxy.hidden = false;
        proxy.textContent = subscribed ? '구독중' : '구독하기';
        proxy.classList.toggle('is-subscribed', subscribed);
        proxy.setAttribute(
          'aria-label',
          subscribed
            ? 'CALF STATION 구독중'
            : 'CALF STATION 구독하기'
        );
        proxy.title =
          subscribed
            ? 'CALF STATION 구독중'
            : 'CALF STATION 구독하기';
      }

      function syncSubscribeProxy() {
        if (syncing) return;

        syncing = true;

        try {
          nativeButton = findNativeSubscribeButton();

          /*
           * 기존 디자인대로 티스토리 원본 구독 버튼은 보이지 않게 두고
           * 검은 CALF 버튼만 표시합니다.
           */
          if (nativeButton) {
            /*
             * display:none 대신 화면 밖으로 이동합니다.
             * Tistory 공식 클릭 핸들러가 '실제 존재하는 구독 버튼'으로
             * 계속 인식할 수 있게 하면서 방문자에게는 보이지 않습니다.
             */
            nativeButton.style.setProperty('position', 'fixed', 'important');
            nativeButton.style.setProperty('left', '-10000px', 'important');
            nativeButton.style.setProperty('top', '-10000px', 'important');
            nativeButton.style.setProperty('width', '1px', 'important');
            nativeButton.style.setProperty('height', '1px', 'important');
            nativeButton.style.setProperty('opacity', '0', 'important');
            nativeButton.style.setProperty('pointer-events', 'none', 'important');
            nativeButton.style.setProperty('overflow', 'hidden', 'important');
          }

          setProxyState(
            nativeSubscriptionConnected() ||
            nativeButtonLooksSubscribed(nativeButton)
          );
        } finally {
          syncing = false;
        }
      }

      function removeBridgeButton() {
        if (
          bridgeButton &&
          bridgeButton.parentNode
        ) {
          bridgeButton.parentNode.removeChild(
            bridgeButton
          );
        }

        bridgeButton = null;
      }

      function buildBridgeButton() {
        removeBridgeButton();

        const blogId = currentBlogId();
        if (!blogId) return null;

        const button = document.createElement('button');

        button.type = 'button';
        button.className =
          'btn_menu_toolbar btn_subscription #subscribe';

        button.setAttribute(
          'data-blog-id',
          blogId
        );
        button.setAttribute(
          'data-url',
          currentBlogUrl()
        );
        button.setAttribute(
          'data-device',
          'web_pc'
        );
        button.setAttribute(
          'data-tiara-action-name',
          '구독 버튼_클릭'
        );
        button.dataset.calfSubscribeBridge = '1';

        /*
         * display:none은 쓰지 않습니다.
         * 공식 이벤트 핸들러가 실제 버튼과 동일하게 처리할 수 있도록
         * 화면 밖 1px 영역에만 둡니다.
         */
        button.style.cssText =
          'position:fixed!important;' +
          'left:-10000px!important;' +
          'top:-10000px!important;' +
          'width:1px!important;' +
          'height:1px!important;' +
          'overflow:hidden!important;' +
          'opacity:0!important;' +
          'pointer-events:none!important;';

        button.innerHTML =
          '<em class="txt_state"></em>' +
          '<strong class="txt_tool_id">CALF STATION</strong>' +
          '<span class="img_common_tistory ico_check_type1"></span>';

        document.body.appendChild(button);
        bridgeButton = button;

        return button;
      }

      function clickOfficialSubscribeButton() {
        nativeButton = findNativeSubscribeButton();

        const target =
          nativeButton ||
          buildBridgeButton();

        if (!target) return false;

        /*
         * 티스토리 공용 스크립트의 공식 구독 이벤트를 그대로 사용합니다.
         * 별도 구독 API 주소나 토큰을 하드코딩하지 않습니다.
         */
        target.click();

        window.setTimeout(function () {
          syncSubscribeProxy();

          /*
           * 임시 bridge는 공식 이벤트 전달 뒤 제거합니다.
           */
          if (
            target.dataset &&
            target.dataset.calfSubscribeBridge === '1'
          ) {
            removeBridgeButton();
          }
        }, 700);

        window.setTimeout(
          syncSubscribeProxy,
          1500
        );

        return true;
      }

      proxy.addEventListener('click', function (event) {
        const loggedIn = isLoggedIn();

        /*
         * Tistory 공식 동작:
         * 로그아웃 방문자가 구독 기능을 누르면 로그인 페이지로 이동합니다.
         * 이 경로를 직접 보장해 '새로고침만 되는' 현상을 차단합니다.
         */
        if (loggedIn === false) {
          event.preventDefault();
          location.href = loginUrl();
          return;
        }

        /*
         * 로그인 상태 또는 T.config 초기화 직후:
         * 공식 구독 버튼에만 클릭을 전달합니다.
         */
        if (clickOfficialSubscribeButton()) {
          return;
        }

        /*
         * T.config가 아직 완전히 준비되지 않은 극초기 클릭은
         * 120ms 뒤 한 번만 재시도합니다.
         */
        window.setTimeout(function () {
          const retryLoggedIn = isLoggedIn();

          if (retryLoggedIn === false) {
            location.href = loginUrl();
            return;
          }

          clickOfficialSubscribeButton();
        }, 120);
      });

      function tryMountSubscribe() {
        tries += 1;

        syncSubscribeProxy();

        /*
         * 공식 구독 버튼이나 T.config 중 하나라도 준비되면
         * 빠른 폴링을 종료합니다.
         */
        if (
          findNativeSubscribeButton() ||
          tistoryConfig() ||
          tries >= 24
        ) {
          if (timer) {
            window.clearInterval(timer);
          }

          timer = 0;
        }
      }

      /*
       * 버튼은 즉시 보여 주고 상태만 뒤에서 동기화합니다.
       * 외형/위치/크기는 기존 검은 버튼 그대로입니다.
       */
      setProxyState(false);
      tryMountSubscribe();

      if (
        !findNativeSubscribeButton() &&
        !tistoryConfig()
      ) {
        timer = window.setInterval(
          tryMountSubscribe,
          250
        );
      }

      /*
       * Tistory가 toolbar를 늦게 렌더링하는 경우를 위한 짧은 보강.
       */
      [350, 900, 1800].forEach(function (delay) {
        window.setTimeout(
          syncSubscribeProxy,
          delay
        );
      });
    })();

    (function () {
      /*
       * CALF STATION 댓글·방명록 익명 캐릭터 아바타
       *
       * 파일명:
       * ./images/comment_avatar_01.png
       * ./images/comment_avatar_02.png
       * ...
       * ./images/comment_avatar_107.png
       *
       * 배정 기준:
       * - 닉네임을 해시한 값으로 107개 중 하나를 고정 배정
       * - 같은 닉네임은 게시글 댓글과 방명록에서 같은 캐릭터 사용
       * - 로그인 사용자의 고유 프로필 이미지는 유지
       * - 꽃송아지 / CALF STATION은 기존 관리자 프로필 유지
       */
      const COMMENT_AVATAR_MAX = 107;
      const COMMENT_AVATAR_PREFIX = './images/comment_avatar_';
      const COMMENT_AVATAR_EXT = '.png';

      const OWNER_NAMES = new Set([
        '꽃송아지',
        'CALF STATION'
      ]);

      const COMMUNITY_ROOT_SELECTOR = '.comment-wrap, .guestbook-wrap';

      const state = {
        observer: null,
        scheduled: false,
        started: false,

        /*
         * V6.18.92:
         * 프로젝트 히스토리 최신글 댓글은 페이지 진입 뒤 fetch로 늦게 삽입됩니다.
         * 이미 감시 중인 댓글 root와 새로 생긴 root를 구분하기 위해 사용합니다.
         */
        observedRoots: new WeakSet()
      };

      function normalizeNickname(value) {
        let name = String(value || '')
          .replace(/\s+/g, ' ')
          .trim();

        if (typeof name.normalize === 'function') {
          name = name.normalize('NFKC');
        }

        return name.toLocaleLowerCase('ko-KR');
      }

      function isOwnerName(value) {
        const normalized = normalizeNickname(value);

        return Array.from(OWNER_NAMES).some(function (ownerName) {
          return normalizeNickname(ownerName) === normalized;
        });
      }

      function stableNicknameHash(value) {
        const text = normalizeNickname(value);
        let hash = 2166136261;

        for (let index = 0; index < text.length; index += 1) {
          hash ^= text.charCodeAt(index);
          hash = Math.imul(hash, 16777619);
        }

        return hash >>> 0;
      }

      function avatarUrlByNickname(nickname) {
        const avatarIndex =
          (stableNicknameHash(nickname) % COMMENT_AVATAR_MAX) + 1;

        const number = String(avatarIndex).padStart(2, '0');

        return COMMENT_AVATAR_PREFIX + number + COMMENT_AVATAR_EXT;
      }

      function getAvatarReference(element) {
        if (!element) return '';

        if (element instanceof HTMLImageElement) {
          return element.currentSrc || element.src || '';
        }

        const inlineValue = element.style.backgroundImage || '';
        const computedValue =
          window.getComputedStyle(element).backgroundImage || '';

        return inlineValue && inlineValue !== 'none'
          ? inlineValue
          : computedValue;
      }

      function isGenericTistoryAvatar(reference) {
        const value = String(reference || '').toLowerCase();

        if (!value || value === 'none') return true;

        return [
          'default',
          'anonymous',
          'profile_default',
          'reply_default',
          'ico_profile',
          'tistory_admin/static/images/reply',
          'tistory_admin/static/images/profile'
        ].some(function (token) {
          return value.indexOf(token) !== -1;
        });
      }

      function getEntryAuthor(item) {
        const author =
          item.querySelector(':scope > .tt-wrap-cmt .tt-link-user') ||
          item.querySelector(':scope > div .tt-link-user') ||
          item.querySelector('.tt-link-user');

        return {
          element: author,
          name: author ? (author.textContent || '').trim() : ''
        };
      }

      function getEntryThumbnail(item) {
        return (
          item.querySelector(
            ':scope > .tt-wrap-cmt .tt-box-thumb .tt-thumbnail'
          ) ||
          item.querySelector(
            ':scope > div .tt-box-thumb .tt-thumbnail'
          ) ||
          item.querySelector('.tt-box-thumb .tt-thumbnail')
        );
      }

      function isGuestLikeAuthor(authorElement) {
        if (!authorElement) return true;

        const href = (authorElement.getAttribute('href') || '').trim();

        return (
          !href ||
          href === '#' ||
          href.indexOf('javascript:') === 0
        );
      }

      function collectCommunityEntries() {
        const seen = new Set();
        const entries = [];

        document.querySelectorAll(COMMUNITY_ROOT_SELECTOR).forEach(function (root) {
          root.querySelectorAll(
            '.tt-list-reply .tt-item-reply, .tt-item-reply'
          ).forEach(function (item) {
            if (seen.has(item)) return;
            seen.add(item);

            const author = getEntryAuthor(item);
            const thumbnail = getEntryThumbnail(item);

            if (!author.name || !thumbnail) return;

            entries.push({
              item: item,
              authorElement: author.element,
              nickname: author.name,
              thumbnail: thumbnail,
              avatarReference: getAvatarReference(thumbnail)
            });
          });
        });

        return entries;
      }

      function shouldReplaceCommunityAvatar(entry) {
        if (!entry.nickname || !entry.thumbnail) return false;
        if (isOwnerName(entry.nickname)) return false;

        if (entry.thumbnail.dataset.calfRandomAvatar === '1') {
          return true;
        }

        /*
         * 티스토리 기본 회색 프로필 또는 홈페이지가 없는 익명 작성자만
         * 열혈 캐릭터로 교체합니다. 로그인 사용자의 실제 프로필은 유지합니다.
         */
        return (
          isGenericTistoryAvatar(entry.avatarReference) ||
          isGuestLikeAuthor(entry.authorElement)
        );
      }

      function rememberOriginalAvatar(thumbnail) {
        if (
          !thumbnail ||
          thumbnail.dataset.calfOriginalAvatarSaved === '1'
        ) {
          return;
        }

        thumbnail.dataset.calfOriginalAvatarSaved = '1';

        if (thumbnail instanceof HTMLImageElement) {
          thumbnail.dataset.calfOriginalSrc =
            thumbnail.getAttribute('src') || '';
          thumbnail.dataset.calfOriginalSrcset =
            thumbnail.getAttribute('srcset') || '';
          return;
        }

        thumbnail.dataset.calfOriginalBackgroundImage =
          thumbnail.style.backgroundImage || '';
        thumbnail.dataset.calfOriginalBackgroundPosition =
          thumbnail.style.backgroundPosition || '';
        thumbnail.dataset.calfOriginalBackgroundRepeat =
          thumbnail.style.backgroundRepeat || '';
        thumbnail.dataset.calfOriginalBackgroundSize =
          thumbnail.style.backgroundSize || '';
      }

      function applyAvatarToThumbnail(thumbnail, url, nickname) {
        if (!thumbnail || !url) return;

        rememberOriginalAvatar(thumbnail);

        thumbnail.dataset.calfRandomAvatar = '1';
        thumbnail.dataset.calfAvatarNickname = nickname;
        thumbnail.classList.add('calf-random-comment-avatar');

        if (thumbnail instanceof HTMLImageElement) {
          thumbnail.src = url;
          thumbnail.removeAttribute('srcset');
          thumbnail.alt = nickname + ' 캐릭터 아바타';
          return;
        }

        thumbnail.style.setProperty(
          'background-image',
          'url("' + url.replace(/"/g, '%22') + '")',
          'important'
        );
        thumbnail.style.setProperty(
          'background-position',
          'center',
          'important'
        );
        thumbnail.style.setProperty(
          'background-repeat',
          'no-repeat',
          'important'
        );
        thumbnail.style.setProperty(
          'background-size',
          'contain',
          'important'
        );
      }

      function restoreOriginalAvatar(thumbnail) {
        if (!thumbnail) return;

        thumbnail.classList.remove('calf-random-comment-avatar');
        delete thumbnail.dataset.calfRandomAvatar;
        delete thumbnail.dataset.calfAvatarNickname;

        if (thumbnail instanceof HTMLImageElement) {
          const originalSrc =
            thumbnail.dataset.calfOriginalSrc || '';
          const originalSrcset =
            thumbnail.dataset.calfOriginalSrcset || '';

          if (originalSrc) {
            thumbnail.setAttribute('src', originalSrc);
          } else {
            thumbnail.removeAttribute('src');
          }

          if (originalSrcset) {
            thumbnail.setAttribute('srcset', originalSrcset);
          } else {
            thumbnail.removeAttribute('srcset');
          }

          return;
        }

        thumbnail.style.backgroundImage =
          thumbnail.dataset.calfOriginalBackgroundImage || '';
        thumbnail.style.backgroundPosition =
          thumbnail.dataset.calfOriginalBackgroundPosition || '';
        thumbnail.style.backgroundRepeat =
          thumbnail.dataset.calfOriginalBackgroundRepeat || '';
        thumbnail.style.backgroundSize =
          thumbnail.dataset.calfOriginalBackgroundSize || '';
      }

      /*
       * V6.18.83 · 방명록 패미컴 A/B 아바타 버튼용 스타일 표식
       * ------------------------------------------------------------
       * 기능 변경이 아니라 CSS가 주인장/일반 방문자를 구분할 수 있도록
       * 기존 .tt-box-thumb에 class만 붙입니다.
       *
       * - 주인장(꽃송아지 / CALF STATION): is-owner → 빨강 + 금색 + A
       * - 일반 방문자: is-visitor → 검정 + 회색 + B
       *
       * 댓글(.comment-wrap)은 건드리지 않고 방명록(.guestbook-wrap)에만 적용합니다.
       * 기존 랜덤 캐릭터 배정, 로그인 사용자 프로필 유지 정책도 그대로입니다.
       */
      function markGuestbookAvatarButton(entry) {
        if (!entry || !entry.item || !entry.thumbnail) return;

        const guestbookRoot =
          entry.item.closest('.guestbook-wrap');

        if (!guestbookRoot) return;

        const box =
          entry.thumbnail.closest('.tt-box-thumb');

        if (!box) return;

        const owner =
          isOwnerName(entry.nickname);

        box.classList.add(
          'calf-guestbook-pad-avatar'
        );

        box.classList.toggle(
          'is-owner',
          owner
        );

        box.classList.toggle(
          'is-visitor',
          !owner
        );
      }

      /*
       * ============================================================
       * V6.18.117 · ARTICLE COMMENT AVATAR MARKER
       * ------------------------------------------------------------
       * 방명록에서 확정된 원형 규격을 댓글/대댓글에도 적용하기 위한
       * class marker입니다. 실제 정렬/아바타 배정 로직은 바꾸지 않습니다.
       * ============================================================ */
      function markCommentAvatarButton(entry) {
        if (!entry || !entry.item || !entry.thumbnail) return;

        const commentRoot =
          entry.item.closest(
            '.comment-wrap'
          );

        if (!commentRoot) return;

        const box =
          entry.thumbnail.closest(
            '.tt-box-thumb'
          );

        if (!box) return;

        const owner =
          isOwnerName(
            entry.nickname
          );

        box.classList.add(
          'calf-comment-pad-avatar'
        );

        box.classList.toggle(
          'is-owner',
          owner
        );

        box.classList.toggle(
          'is-visitor',
          !owner
        );
      }


      function applyCommunityListAvatars() {
        collectCommunityEntries().forEach(function (entry) {
          /*
           * 아바타 교체 여부와 무관하게 방명록에서는 A/B 버튼 외형을 적용합니다.
           * 이 줄은 visual marker만 추가하며 shouldReplaceCommunityAvatar()의
           * 기존 판단 및 실제 이미지 교체 로직에는 영향을 주지 않습니다.
           */
          markGuestbookAvatarButton(entry);

          /*
           * V6.18.117:
           * 게시물 댓글/대댓글에도 방명록과 동일한 원형 프레임 marker만 추가.
           * A/B 문자는 CSS에서 만들지 않습니다.
           */
          markCommentAvatarButton(entry);

          if (!shouldReplaceCommunityAvatar(entry)) return;

          applyAvatarToThumbnail(
            entry.thumbnail,
            avatarUrlByNickname(entry.nickname),
            entry.nickname
          );
        });
      }

      function findWriteFormThumbnail(form) {
        if (!form) return null;

        return (
          form.querySelector(
            '.tt-area-write .tt-box-thumb .tt-thumbnail'
          ) ||
          form.querySelector(
            '.tt-box-thumb .tt-thumbnail'
          )
        );
      }

      function bindAnonymousWriteForms() {
        document.querySelectorAll(COMMUNITY_ROOT_SELECTOR).forEach(function (root) {
          const inputs = root.querySelectorAll(
            'input[type="text"][title="이름"], ' +
            'input[type="text"][placeholder="이름"]'
          );

          inputs.forEach(function (input) {
            if (!(input instanceof HTMLInputElement)) return;

            const form = input.closest('form');
            const thumbnail = findWriteFormThumbnail(form);

            if (!thumbnail) return;

            rememberOriginalAvatar(thumbnail);

            function updatePreview() {
              const nickname = (input.value || '').trim();

              if (!nickname || isOwnerName(nickname)) {
                restoreOriginalAvatar(thumbnail);
                return;
              }

              applyAvatarToThumbnail(
                thumbnail,
                avatarUrlByNickname(nickname),
                nickname
              );
            }

            if (input.dataset.calfAvatarBound !== '1') {
              input.dataset.calfAvatarBound = '1';
              input.addEventListener('input', updatePreview);
              input.addEventListener('change', updatePreview);
              input.addEventListener('blur', updatePreview);
            }

            updatePreview();
          });
        });
      }

      function runCommunityAvatarUpdate() {
        state.scheduled = false;
        applyCommunityListAvatars();
        bindAnonymousWriteForms();
      }

      function scheduleCommunityAvatarUpdate() {
        if (state.scheduled) return;

        state.scheduled = true;
        window.requestAnimationFrame(runCommunityAvatarUpdate);
      }

      function initCommunityAvatars() {
        const roots =
          document.querySelectorAll(
            COMMUNITY_ROOT_SELECTOR
          );

        if (!roots.length) return;

        if (!state.observer) {
          state.observer =
            new MutationObserver(function () {
              scheduleCommunityAvatarUpdate();
            });
        }

        let addedRoot = false;

        roots.forEach(function (root) {
          if (state.observedRoots.has(root)) {
            return;
          }

          state.observedRoots.add(root);
          addedRoot = true;

          state.observer.observe(root, {
            childList: true,
            subtree: true
          });
        });

        state.started = true;

        /*
         * 기존 댓글/방명록뿐 아니라 V6.18.92에서 늦게 삽입되는
         * 프로젝트 히스토리 최신글 댓글에도 동일 아바타 정책을 적용합니다.
         */
        if (addedRoot) {
          scheduleCommunityAvatarUpdate();

          window.setTimeout(
            scheduleCommunityAvatarUpdate,
            180
          );

          window.setTimeout(
            scheduleCommunityAvatarUpdate,
            650
          );
        }
      }

      function startCommunityAvatarsFastAware() {
        let path = location.pathname;
        try { path = decodeURIComponent(path); } catch (err) {}

        const isGuestbook =
          (document.body && document.body.id === 'tt-body-guestbook') ||
          /^\/guestbook\/?$/i.test(path);

        if (!isGuestbook) {
          initCommunityAvatars();
          return;
        }

        /*
         * 방명록에서는 글 목록 자체가 먼저 화면에 뜨는 것이 우선입니다.
         * 아바타 치환은 첫 페인트 직후로 미뤄 초기 메인스레드 경쟁을 줄입니다.
         */
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(initCommunityAvatars, { timeout: 720 });
        } else {
          window.setTimeout(initCommunityAvatars, 360);
        }
      }

      /*
       * V6.18.92:
       * fetch로 댓글 DOM이 나중에 삽입되면 history renderer가
       * calf:community-mounted 이벤트를 보냅니다.
       */
      window.addEventListener(
        'calf:community-mounted',
        initCommunityAvatars
      );

      if (document.readyState === 'loading') {
        document.addEventListener(
          'DOMContentLoaded',
          startCommunityAvatarsFastAware
        );
      } else {
        startCommunityAvatarsFastAware();
      }
    })();


    (function () {
      /*
       * CALF STATION 댓글·방명록 최신순 정렬
       *
       * 대상:
       * - 개별 게시물의 최상위 일반 댓글
       * - 방명록의 최상위 일반 글
       *
       * 제외:
       * - 댓글/방명록의 답글 목록
       * - 핀 고정 방명록
       * - 이전 글·댓글 더보기 버튼
       * - 기타 티스토리 특수 항목
       *
       * 비일반 항목은 기존 자리를 그대로 유지하고,
       * 일반 항목이 들어 있던 자리끼리만 최신순으로 바꿉니다.
       */
      const SORT_TARGETS = [
        {
          rootSelector: '#tt-body-page .comment-wrap',
          fallbackKey: 'calfCommentFallbackSorted'
        },
        {
          rootSelector: '#tt-body-guestbook .guestbook-wrap',
          fallbackKey: 'calfGuestbookFallbackSorted'
        },
        {
          /*
           * V6.18.92:
           * 프로젝트 히스토리 카테고리에 fetch로 펼친 최신글 댓글.
           * 일반 게시글과 똑같이 원댓글 최신순을 사용합니다.
           */
          rootSelector: '.calf-history-featured-comments',
          fallbackKey: 'calfHistoryFeaturedCommentFallbackSorted'
        }
      ];

      function numericEntryId(item) {
        if (!item) return 0;

        const candidates = [
          item.id || '',
          item.getAttribute('data-id') || '',
          item.getAttribute('data-reply-id') || '',
          item.getAttribute('data-comment-id') || ''
        ];

        item.querySelectorAll('[id]').forEach(function (node) {
          if (candidates.length >= 12) return;
          candidates.push(node.id || '');
        });

        for (const value of candidates) {
          const matches = String(value).match(/\d+/g);
          if (!matches || !matches.length) continue;

          const number = Number(matches[matches.length - 1]);

          if (Number.isFinite(number) && number > 0) {
            return number;
          }
        }

        return 0;
      }

      function isTopLevelList(list, root) {
        if (!(list instanceof HTMLElement)) return false;

        const parentReply = list.closest('li.tt-item-reply');

        if (parentReply && root.contains(parentReply)) {
          return false;
        }

        return Array.from(list.children).some(function (child) {
          return (
            child instanceof HTMLElement &&
            child.matches('li.tt-item-reply.rp_general')
          );
        });
      }

      /*
       * V6.18.88 · 원댓글 최신순 결정용 날짜 파서
       * ------------------------------------------------------------
       * 기존 fallback의 '한 번 뒤집기'는 Tistory React가 목록을 다시 그리는
       * 타이밍에 따라 잠깐 오래된순이 보일 수 있었습니다.
       * 이제 화면에 실제 표시된 작성일을 우선 사용합니다.
       */
      function communityEntryTime(item) {
        if (!(item instanceof HTMLElement)) return 0;

        const dateNode =
          item.querySelector(
            ':scope > .tt-wrap-cmt .tt_date, ' +
            ':scope > .tt-wrap-cmt time, ' +
            ':scope > div .tt_date, ' +
            ':scope > div time'
          ) ||
          item.querySelector('.tt_date, time');

        if (!dateNode) return 0;

        /*
         * V6.18.89 · Tistory 상대시간 지원
         * ------------------------------------------------------------
         * Tistory는 최근 댓글의 날짜를
         *   "방금", "15분 전", "2시간 전", "1일 전"
         * 처럼 표시할 수 있습니다.
         *
         * V88은 "2026. 8. 16. 20:09" 같은 절대시간만 읽었기 때문에
         * 상대시간 댓글은 time=0이 되어 기존 DOM 위치(아래)에 남을 수 있었습니다.
         *
         * 아래 파서는:
         * 1) time 태그의 datetime/data-* 실제 시각
         * 2) YYYY. M. D. HH:MM 절대시간
         * 3) 방금 / N초·분·시간·일·주 전
         * 4) 오늘 / 어제 HH:MM
         * 순서로 읽습니다.
         */
        const attrCandidates = [
          dateNode.getAttribute('datetime'),
          dateNode.getAttribute('data-time'),
          dateNode.getAttribute('data-date'),
          dateNode.getAttribute('data-timestamp')
        ].filter(Boolean);

        for (const raw of attrCandidates) {
          const numeric = Number(raw);

          if (Number.isFinite(numeric) && numeric > 0) {
            /*
             * Unix seconds / milliseconds 양쪽 지원.
             */
            const ms =
              numeric < 100000000000
                ? numeric * 1000
                : numeric;

            if (Number.isFinite(ms)) return ms;
          }

          const parsed = Date.parse(raw);
          if (Number.isFinite(parsed)) return parsed;
        }

        const value =
          String(dateNode.textContent || '')
            .replace(/\s+/g, ' ')
            .trim();

        const absolute = value.match(
          /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*(\d{1,2}):(\d{2})/
        );

        if (absolute) {
          const time = new Date(
            Number(absolute[1]),
            Number(absolute[2]) - 1,
            Number(absolute[3]),
            Number(absolute[4]),
            Number(absolute[5])
          ).getTime();

          if (Number.isFinite(time)) return time;
        }

        const now = Date.now();

        if (/방금|지금/.test(value)) {
          return now;
        }

        const relative = value.match(
          /(\d+)\s*(초|분|시간|일|주)\s*전/
        );

        if (relative) {
          const amount = Number(relative[1]);

          const unitMs = {
            '초': 1000,
            '분': 60 * 1000,
            '시간': 60 * 60 * 1000,
            '일': 24 * 60 * 60 * 1000,
            '주': 7 * 24 * 60 * 60 * 1000
          };

          const delta =
            amount *
            (unitMs[relative[2]] || 0);

          if (delta > 0) {
            return now - delta;
          }
        }

        const todayOrYesterday = value.match(
          /(오늘|어제)(?:\s+(\d{1,2}):(\d{2}))?/
        );

        if (todayOrYesterday) {
          const date = new Date();

          if (todayOrYesterday[1] === '어제') {
            date.setDate(date.getDate() - 1);
          }

          date.setHours(
            todayOrYesterday[2]
              ? Number(todayOrYesterday[2])
              : 0,
            todayOrYesterday[3]
              ? Number(todayOrYesterday[3])
              : 0,
            0,
            0
          );

          return date.getTime();
        }

        return 0;
      }

      function collectGeneralRecords(list) {
        const children = Array.from(list.children);
        const slots = [];
        const records = [];

        children.forEach(function (child, index) {
          if (
            !(child instanceof HTMLElement) ||
            !child.matches('li.tt-item-reply.rp_general')
          ) {
            return;
          }

          slots.push(index);
          records.push({
            item: child,
            id: numericEntryId(child),
            time: communityEntryTime(child),
            originalIndex: records.length
          });
        });

        return {
          children: children,
          slots: slots,
          records: records
        };
      }

      function sortOneTopLevelList(list, fallbackKey) {
        const collected = collectGeneralRecords(list);
        const children = collected.children;
        const slots = collected.slots;
        const records = collected.records;

        if (records.length < 2) {
          list.dataset.calfOrderNewest = '1';
          return false;
        }

        /*
         * 정렬 우선순위:
         * 1) 실제 작성일 최신순
         * 2) 날짜가 같거나 읽지 못했을 때 숫자 ID 최신순
         * 3) 둘 다 없으면 현재 DOM 순서를 보존
         *
         * 즉 더 이상 'ID를 못 찾으면 무조건 reverse'하지 않습니다.
         */
        const sortedRecords = records.slice().sort(function (a, b) {
          if (
            a.time &&
            b.time &&
            a.time !== b.time
          ) {
            return b.time - a.time;
          }

          if (
            a.id &&
            b.id &&
            a.id !== b.id
          ) {
            return b.id - a.id;
          }

          return a.originalIndex - b.originalIndex;
        });

        const currentItems = records.map(function (record) {
          return record.item;
        });

        const alreadySorted = sortedRecords.every(function (record, index) {
          return record.item === currentItems[index];
        });

        if (alreadySorted) {
          list.dataset.calfOrderNewest = '1';
          return false;
        }

        /*
         * 일반 항목이 있던 인덱스에만 정렬 결과를 넣습니다.
         * 핀 글, 더보기 버튼 등 비일반 항목은 같은 인덱스에 남습니다.
         */
        const targetChildren = children.slice();

        slots.forEach(function (slotIndex, sortedIndex) {
          targetChildren[slotIndex] = sortedRecords[sortedIndex].item;
        });

        const fragment = document.createDocumentFragment();

        targetChildren.forEach(function (child) {
          fragment.appendChild(child);
        });

        list.appendChild(fragment);
        list.dataset.calfOrderNewest = '1';
        return true;
      }

      function createSorter(target) {
        const state = {
          observer: null,
          scheduled: false,
          started: false
        };

        function sortRoot() {
          state.scheduled = false;

          const root = document.querySelector(target.rootSelector);
          if (!root) return;

          root.querySelectorAll('ul.tt-list-reply').forEach(function (list) {
            if (!isTopLevelList(list, root)) return;

            sortOneTopLevelList(
              list,
              target.fallbackKey
            );
          });
        }

        function scheduleSort() {
          if (state.scheduled) return;

          state.scheduled = true;
          window.requestAnimationFrame(sortRoot);
        }

        function start() {
          if (state.started) return;

          /*
           * V6.18.92:
           * featured 댓글은 DOMContentLoaded 이후에 생길 수 있으므로
           * root가 아직 없을 때 started=true로 잠그지 않습니다.
           */
          const root =
            document.querySelector(
              target.rootSelector
            );

          if (!root) return;

          state.started = true;

          state.observer = new MutationObserver(function (mutations) {
            const hasChildChange = mutations.some(function (mutation) {
              return mutation.type === 'childList';
            });

            if (hasChildChange) {
              scheduleSort();
            }
          });

          state.observer.observe(root, {
            childList: true,
            subtree: true
          });

          scheduleSort();
          window.setTimeout(scheduleSort, 300);
          window.setTimeout(scheduleSort, 900);
          window.setTimeout(scheduleSort, 1800);
        }

        return start;
      }

      const starters = SORT_TARGETS.map(createSorter);

      function initCommunityNewestFirst() {
        starters.forEach(function (start) {
          start();
        });
      }

      function startCommunityNewestFirstFastAware() {
        let path = location.pathname;
        try { path = decodeURIComponent(path); } catch (err) {}

        const isGuestbook =
          (document.body && document.body.id === 'tt-body-guestbook') ||
          /^\/guestbook\/?$/i.test(path);

        if (!isGuestbook) {
          initCommunityNewestFirst();
          return;
        }

        /*
         * V6.18.88:
         * 방명록은 React 목록 삽입 Mutation을 다음 페인트 전에 잡을 수 있도록
         * sorter observer를 즉시 장착합니다.
         * '오래된순이 잠깐 보였다가 최신순으로 뒤집히는' 현상을 줄입니다.
         */
        initCommunityNewestFirst();
      }

      /*
       * V6.18.92:
       * 최신 작업기의 댓글이 fetch 후 삽입되면 새 root sorter를 시작합니다.
       */
      window.addEventListener(
        'calf:community-mounted',
        initCommunityNewestFirst
      );

      if (document.readyState === 'loading') {
        document.addEventListener(
          'DOMContentLoaded',
          startCommunityNewestFirstFastAware
        );
      } else {
        startCommunityNewestFirstFastAware();
      }
    })();

    (function () {
      /*
       * CALF STATION V6.18.47
       * 방명록 정렬 규칙:
       * - 원댓글: 최신 작성순 (기존 공용 정렬기 유지)
       * - 대댓글: 이전 작성순 / 시간 오름차순 (대화 흐름 유지)
       *
       * 티스토리 기본 방명록은 React가 내부 DOM을 바꿀 수 있으므로
       * 특정 중첩 ul 클래스 하나에만 의존하지 않습니다.
       *
       * 처리 순서:
       * 1) 각 rp_general 원글 내부에서 날짜를 가진 실제 reply li를 수집
       * 2) reply들이 들어 있는 실제 부모 컨테이너별로 최신순 재배치
       * 3) 구형/변형 구조처럼 원글 뒤에 reply가 형제 li로 이어지는 경우도 처리
       *
       * 원글 순서, 작성폼, 인피니티 스크롤, 핀 글은 건드리지 않습니다.
       */

      function parseDateText(text) {
        const value =
          String(text || '')
            .replace(/\s+/g, ' ')
            .trim();

        const absolute = value.match(
          /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*(\d{1,2}):(\d{2})/
        );

        if (absolute) {
          const time = new Date(
            Number(absolute[1]),
            Number(absolute[2]) - 1,
            Number(absolute[3]),
            Number(absolute[4]),
            Number(absolute[5])
          ).getTime();

          if (Number.isFinite(time)) {
            return time;
          }
        }

        /*
         * V6.18.92:
         * 대댓글도 "2시간 전 / 15분 전 / 방금"을 읽어
         * 오래된→최신 정책을 유지합니다.
         */
        const now = Date.now();

        if (/방금|지금/.test(value)) {
          return now;
        }

        const relative = value.match(
          /(\d+)\s*(초|분|시간|일|주)\s*전/
        );

        if (relative) {
          const amount =
            Number(relative[1]);

          const unitMs = {
            '초': 1000,
            '분': 60 * 1000,
            '시간': 60 * 60 * 1000,
            '일': 24 * 60 * 60 * 1000,
            '주': 7 * 24 * 60 * 60 * 1000
          };

          return (
            now -
            amount *
            (unitMs[relative[2]] || 0)
          );
        }

        return 0;
      }

      function numericId(item) {
        if (!(item instanceof HTMLElement)) return 0;
        const values = [
          item.id || '',
          item.getAttribute('data-id') || '',
          item.getAttribute('data-reply-id') || '',
          item.getAttribute('data-comment-id') || ''
        ];

        item.querySelectorAll('[id]').forEach(function (node) {
          if (values.length < 16) values.push(node.id || '');
        });

        for (const value of values) {
          const nums = String(value).match(/\d+/g);
          if (!nums || !nums.length) continue;
          const n = Number(nums[nums.length - 1]);
          if (Number.isFinite(n) && n > 0) return n;
        }
        return 0;
      }

      function entryTime(item) {
        if (!(item instanceof HTMLElement)) return 0;
        const date = item.querySelector('.tt_date, time');
        return date ? parseDateText(date.textContent) : 0;
      }

      function sortRecords(items) {
        return items
          .map(function (item, index) {
            return {
              item: item,
              time: entryTime(item),
              id: numericId(item),
              index: index
            };
          })
          .sort(function (a, b) {
            /* 대댓글은 오래된 글 -> 새 글 순서로 읽히도록 정렬 */
            if (a.time && b.time && a.time !== b.time) return a.time - b.time;
            if (a.id && b.id && a.id !== b.id) return a.id - b.id;
            /* 날짜/ID를 못 읽으면 티스토리의 현재 출력 순서를 그대로 보존 */
            return a.index - b.index;
          })
          .map(function (record) {
            return record.item;
          });
      }

      function isSameOrder(a, b) {
        return a.length === b.length && a.every(function (item, index) {
          return item === b[index];
        });
      }

      function reorderDirectChildren(parent, items) {
        if (!(parent instanceof HTMLElement) || items.length < 2) return false;
        const sorted = sortRecords(items);
        if (isSameOrder(items, sorted)) return false;

        /*
         * 중요: 기준 노드를 먼저 DocumentFragment로 옮긴 뒤 insertBefore의
         * referenceNode로 다시 쓰면 NotFoundError가 발생하면서 대댓글이
         * DOM에서 빠진 채 남을 수 있습니다. 먼저 자리표시자를 심고 난 뒤
         * 안전하게 재삽입합니다.
         */
        const marker = document.createComment('calf-reply-sort-anchor');
        parent.insertBefore(marker, items[0]);

        const fragment = document.createDocumentFragment();
        sorted.forEach(function (item) {
          fragment.appendChild(item);
        });
        parent.insertBefore(fragment, marker);
        marker.remove();
        return true;
      }

      function looksLikeReplyItem(item) {
        if (!(item instanceof HTMLElement)) return false;
        return !!(
          item.querySelector('.tt_date, time') &&
          item.querySelector('.tt-wrap-cmt, .tt-link-user, .tt_desc')
        );
      }

      function sortNestedRepliesForGeneral(general) {
        let changed = false;
        const groups = new Map();
        const seen = new Set();

        /*
         * 핵심: 클래스명이 바뀌어도 .tt_date에서 가장 가까운 reply li를 역추적합니다.
         * 원글 자신의 날짜는 general 자신으로 귀결되므로 제외됩니다.
         */
        general.querySelectorAll('.tt_date, time').forEach(function (dateNode) {
          let item = dateNode.closest('li.tt-item-reply');
          if (!item) item = dateNode.closest('li');

          if (
            !(item instanceof HTMLElement) ||
            item === general ||
            !general.contains(item) ||
            seen.has(item) ||
            !looksLikeReplyItem(item)
          ) {
            return;
          }

          seen.add(item);
          const parent = item.parentElement;
          if (!(parent instanceof HTMLElement)) return;
          if (!groups.has(parent)) groups.set(parent, []);
          groups.get(parent).push(item);
        });

        groups.forEach(function (items, parent) {
          /* DOM 현재 순서 기준으로 먼저 정렬 대상 배열을 복원 */
          const ordered = Array.from(parent.children).filter(function (child) {
            return items.includes(child);
          });
          if (reorderDirectChildren(parent, ordered)) changed = true;
        });

        /*
         * 보조 경로: reply list의 클래스명이 달라져도 ul/ol 직계 자식이
         * 실제 댓글 모양이면 그 컨테이너를 정렬합니다.
         */
        general.querySelectorAll('ul, ol').forEach(function (list) {
          const replies = Array.from(list.children).filter(looksLikeReplyItem);
          if (replies.length >= 2 && reorderDirectChildren(list, replies)) {
            changed = true;
          }
        });

        return changed;
      }

      function sortFlatSiblingReplies(topList) {
        let changed = false;
        const children = Array.from(topList.children);
        let i = 0;

        while (i < children.length) {
          const general = children[i];
          if (!(general instanceof HTMLElement) || !general.matches('li.rp_general')) {
            i += 1;
            continue;
          }

          const replies = [];
          let j = i + 1;
          while (j < children.length) {
            const item = children[j];
            if (!(item instanceof HTMLElement)) break;
            if (item.matches('li.rp_general')) break;

            if (item.matches('li') && looksLikeReplyItem(item)) {
              replies.push(item);
              j += 1;
              continue;
            }
            break;
          }

          if (replies.length >= 2 && reorderDirectChildren(topList, replies)) {
            changed = true;
          }
          i = Math.max(j, i + 1);
        }
        return changed;
      }

      function visualReplyLeft(item) {
        if (!(item instanceof HTMLElement)) return 0;
        const target = item.querySelector('.tt-wrap-cmt') || item;
        const rect = target.getBoundingClientRect();
        return Number.isFinite(rect.left) ? rect.left : 0;
      }

      /*
       * 티스토리 React 방명록은 일부 환경에서 원글/대댓글 모두
       * li.rp_general 로 출력합니다. 이 경우 클래스만으로는 둘을
       * 구분할 수 없으므로 실제 화면의 들여쓰기 위치를 기준으로
       * "원글 뒤에 이어지는 대댓글 묶음"을 찾습니다.
       */
      function sortVisualReplyBlocks(topList) {
        const candidates = Array.from(topList.children).filter(function (item) {
          return item instanceof HTMLElement && looksLikeReplyItem(item);
        });
        if (candidates.length < 3) return false;

        const leftValues = candidates.map(visualReplyLeft).filter(Number.isFinite);
        if (!leftValues.length) return false;
        const baseLeft = Math.min.apply(Math, leftValues);
        const DEPTH_EPSILON = 14;
        let changed = false;
        let i = 0;

        while (i < candidates.length) {
          const parent = candidates[i];
          const parentLeft = visualReplyLeft(parent);

          /* 들여쓰기된 항목에서 시작했다면 다음 원글까지 진행 */
          if (parentLeft > baseLeft + DEPTH_EPSILON) {
            i += 1;
            continue;
          }

          const replies = [];
          let j = i + 1;
          while (j < candidates.length) {
            const item = candidates[j];
            const left = visualReplyLeft(item);
            if (left <= baseLeft + DEPTH_EPSILON) break;
            replies.push(item);
            j += 1;
          }

          if (replies.length >= 2) {
            const sorted = sortRecords(replies);
            if (!isSameOrder(replies, sorted)) {
              /* 첫 대댓글 위치에 이전 작성순 묶음을 안전하게 재삽입 */
              const marker = document.createComment('calf-reply-sort-anchor');
              topList.insertBefore(marker, replies[0]);
              const fragment = document.createDocumentFragment();
              sorted.forEach(function (item) { fragment.appendChild(item); });
              topList.insertBefore(fragment, marker);
              marker.remove();
              changed = true;
            }
          }

          i = Math.max(j, i + 1);
        }
        return changed;
      }

      function findTopLists(root) {
        return Array.from(root.querySelectorAll('ul.tt-list-reply, .tt-area-reply > ul')).filter(
          function (list) {
            return (
              list instanceof HTMLElement &&
              !list.closest('li.tt-item-reply') &&
              Array.from(list.children).some(function (child) {
                return child instanceof HTMLElement && child.matches('li.rp_general');
              })
            );
          }
        );
      }

      function initGuestbookReplyOldestFirst() {
        const path =
          location.pathname.replace(
            /\/+$/,
            ''
          ) || '/';

        const roots = [];

        const isGuestbook =
          (
            document.body &&
            document.body.id ===
              'tt-body-guestbook'
          ) ||
          /^\/guestbook$/i.test(path);

        if (isGuestbook) {
          const guestbookRoot =
            document.querySelector(
              '.guestbook-wrap'
            );

          if (guestbookRoot) {
            roots.push(
              guestbookRoot
            );
          }
        }

        /*
         * V6.18.92:
         * 프로젝트 히스토리 최신 작업기의 댓글/대댓글에도
         * 기존 정책(대댓글 오래된→최신)을 똑같이 적용합니다.
         */
        document
          .querySelectorAll(
            '.calf-history-featured-comments'
          )
          .forEach(function (root) {
            roots.push(root);
          });

        if (!roots.length) return;

        roots.forEach(function (root) {
          /*
           * 같은 root에 observer를 중복 설치하지 않습니다.
           */
          if (
            root.dataset
              .calfReplyOldestObserver ===
              '1'
          ) {
            return;
          }

          root.dataset
            .calfReplyOldestObserver = '1';

          let scheduled = false;
          let running = false;

          function run() {
            scheduled = false;

            if (running) return;

            running = true;

            try {
              findTopLists(root)
                .forEach(function (topList) {
                  Array.from(
                    topList.children
                  ).forEach(function (child) {
                    if (
                      child instanceof
                        HTMLElement &&
                      child.matches(
                        'li.rp_general'
                      )
                    ) {
                      sortNestedRepliesForGeneral(
                        child
                      );
                    }
                  });

                  sortFlatSiblingReplies(
                    topList
                  );

                  sortVisualReplyBlocks(
                    topList
                  );

                  topList.dataset
                    .calfReplyOrderOldest =
                    '1';
                });
            } finally {
              running = false;
            }
          }

          function schedule() {
            if (scheduled) return;

            scheduled = true;

            window.requestAnimationFrame(
              run
            );
          }

          const observer =
            new MutationObserver(
              function (mutations) {
                if (
                  mutations.some(
                    function (mutation) {
                      return (
                        mutation.type ===
                        'childList'
                      );
                    }
                  )
                ) {
                  schedule();
                }
              }
            );

          observer.observe(root, {
            childList: true,
            subtree: true
          });

          schedule();

          [
            250,
            700,
            1400,
            2600,
            5000
          ].forEach(
            function (delay) {
              window.setTimeout(
                schedule,
                delay
              );
            }
          );
        });
      }

      function startGuestbookReplySortFastAware() {
        /*
         * V6.18.88 · 방명록 대댓글 정책 고정
         * - 원댓글: 최신순
         * - 대댓글: 오래된 작성순 → 최신 작성 대댓글이 항상 맨 아래
         *
         * 이전에는 idle 시점까지 미뤄 순간적으로 반대 순서가 보일 수 있었으므로
         * observer를 즉시 장착합니다. 정렬 규칙 자체는 바꾸지 않습니다.
         */
        initGuestbookReplyOldestFirst();
      }

      /*
       * V6.18.92:
       * featured 댓글이 나중에 들어오면 대댓글 sorter도 즉시 붙입니다.
       */
      window.addEventListener(
        'calf:community-mounted',
        startGuestbookReplySortFastAware
      );

      if (document.readyState === 'loading') {
        document.addEventListener(
          'DOMContentLoaded',
          startGuestbookReplySortFastAware
        );
      } else {
        startGuestbookReplySortFastAware();
      }
    })();

    (function () {
      const PATCHER_ORIGIN = 'https://calfstation.github.io';
      const PATCHER_BASE = PATCHER_ORIGIN + '/';

      function esc(value) {
        return String(value || '').replace(/[&<>"']/g, function (m) {
          return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m];
        });
      }

      function getData(el, key, fallback) {
        const value = el.dataset[key];
        return value === undefined || value === '' ? fallback : value;
      }


      const PATCHER_BUILD = '20260717-v8';

      function buildPatcherUrl(config, embedMode) {
        const url = new URL(PATCHER_BASE);
        const patchUrl = new URL(config.patchUrl, location.href);

        if (patchUrl.origin !== PATCHER_ORIGIN) {
          throw new Error('패치 파일 주소는 calfstation.github.io 내부 주소여야 합니다.');
        }

        url.searchParams.set('patch', patchUrl.pathname.replace(/^\/+/, ''));
        url.searchParams.set('title', config.title);
        url.searchParams.set('version', config.version);
        url.searchParams.set('original', config.original);
        url.searchParams.set('app', PATCHER_BUILD);

        if (embedMode) url.searchParams.set('embed', '1');
        if (config.crc32) url.searchParams.set('crc', config.crc32);
        if (config.sha1) url.searchParams.set('sha1', config.sha1);
        if (config.sha256) url.searchParams.set('sha256', config.sha256);

        if (config.patchedSize) {
          url.searchParams.set('psize', config.patchedSize);
        }
        if (config.patchedCrc32) {
          url.searchParams.set('pcrc', config.patchedCrc32);
        }
        if (config.patchedSha1) {
          url.searchParams.set('psha1', config.patchedSha1);
        }
        if (config.patchedSha256) {
          url.searchParams.set('psha256', config.patchedSha256);
        }

        return url.href;
      }

      function normalizeImageUrl(value) {
        const raw =
          String(
            value == null
              ? ''
              : value
          ).trim();

        /*
         * new URL('', location.href)는 현재 게시물 주소를 반환합니다.
         * 이 때문에 data-video1이 없는 글에도 빈 VIDEO 칸이 생겼습니다.
         * 빈 값과 문자열 null/undefined는 URL 처리 전에 즉시 거부합니다.
         */
        if (
          !raw ||
          raw.toLowerCase() === 'null' ||
          raw.toLowerCase() === 'undefined'
        ) {
          return '';
        }

        try {
          const url = new URL(raw, location.href);
          if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';

          const githubBlobPrefix =
            '/calfstation/calfstation.github.io/blob/main/';
          const githubRawPrefix =
            '/calfstation/calfstation.github.io/raw/refs/heads/main/';
          const rawGithubPrefix =
            '/calfstation/calfstation.github.io/main/';

          if (
            url.hostname === 'github.com' &&
            url.pathname.indexOf(githubBlobPrefix) === 0
          ) {
            return 'https://calfstation.github.io/' +
              url.pathname.slice(githubBlobPrefix.length);
          }

          if (
            url.hostname === 'github.com' &&
            url.pathname.indexOf(githubRawPrefix) === 0
          ) {
            return 'https://calfstation.github.io/' +
              url.pathname.slice(githubRawPrefix.length);
          }

          if (
            url.hostname === 'raw.githubusercontent.com' &&
            url.pathname.indexOf(rawGithubPrefix) === 0
          ) {
            return 'https://calfstation.github.io/' +
              url.pathname.slice(rawGithubPrefix.length);
          }

          return url.href;
        } catch (err) {
          return '';
        }
      }

      function patchMediaMime(url) {
        const clean = String(url || '')
          .split(/[?#]/)[0]
          .toLowerCase();

        if (clean.endsWith('.webm')) {
          return 'video/webm';
        }

        if (
          clean.endsWith('.ogg') ||
          clean.endsWith('.ogv')
        ) {
          return 'video/ogg';
        }

        if (
          clean.endsWith('.m4v') ||
          clean.endsWith('.mp4')
        ) {
          return 'video/mp4';
        }

        if (clean.endsWith('.mov')) {
          return 'video/quicktime';
        }

        if (clean.endsWith('.avi')) {
          return 'video/x-msvideo';
        }

        return '';
      }

      function buildGallery(config) {
        const images = config.images
          .map(normalizeImageUrl)
          .filter(Boolean);

        const video =
          normalizeImageUrl(config.video);

        if (
          !images.length &&
          !video
        ) {
          return '';
        }

        return `
          <h2>패치 스크린샷 · 영상</h2>
          <div
            class="calf-patch-media-gallery"
            data-calf-patch-media-gallery>
          </div>
        `;
      }

      function ensurePatchLightbox() {
        let lightbox =
          document.getElementById(
            'calf-patch-lightbox'
          );

        if (lightbox) return lightbox;

        lightbox =
          document.createElement('div');

        lightbox.id =
          'calf-patch-lightbox';

        lightbox.className =
          'calf-patch-lightbox';

        lightbox.hidden = true;

        lightbox.innerHTML = `
          <div
            class="calf-patch-lightbox-backdrop"
            data-calf-lightbox-close>
          </div>

          <div
            class="calf-patch-lightbox-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="패치 스크린샷과 영상 확대">
            <button
              class="calf-patch-lightbox-close"
              type="button"
              aria-label="닫기"
              data-calf-lightbox-close>
              ×
            </button>

            <button
              class="calf-patch-lightbox-nav is-prev"
              type="button"
              aria-label="이전 이미지"
              data-calf-lightbox-prev>
              ‹
            </button>

            <figure
              class="calf-patch-lightbox-figure">
              <div
                class="calf-patch-lightbox-media-stage">
                <img
                  class="calf-patch-lightbox-image"
                  alt=""
                  hidden
                >

                <video
                  class="calf-patch-lightbox-video"
                  controls
                  playsinline
                  preload="metadata"
                  controlslist="nodownload"
                  hidden>
                </video>
              </div>

              <figcaption
                class="calf-patch-lightbox-caption">
              </figcaption>
            </figure>

            <button
              class="calf-patch-lightbox-nav is-next"
              type="button"
              aria-label="다음 이미지"
              data-calf-lightbox-next>
              ›
            </button>
          </div>
        `;

        document.body.appendChild(
          lightbox
        );

        const closeButtons =
          lightbox.querySelectorAll(
            '[data-calf-lightbox-close]'
          );

        closeButtons.forEach(
          function (button) {
            button.addEventListener(
              'click',
              closePatchLightbox
            );
          }
        );

        lightbox
          .querySelector(
            '[data-calf-lightbox-prev]'
          )
          .addEventListener(
            'click',
            function () {
              movePatchLightbox(-1);
            }
          );

        lightbox
          .querySelector(
            '[data-calf-lightbox-next]'
          )
          .addEventListener(
            'click',
            function () {
              movePatchLightbox(1);
            }
          );

        attachPatchLightboxSwipe(lightbox);

        return lightbox;
      }

      function attachPatchLightboxSwipe(lightbox) {
        if (
          !lightbox ||
          lightbox.dataset.calfSwipeReady === '1'
        ) {
          return;
        }

        const stage = lightbox.querySelector(
          '.calf-patch-lightbox-media-stage'
        );

        if (!stage) return;

        lightbox.dataset.calfSwipeReady = '1';

        let pointerId = null;
        let startX = 0;
        let startY = 0;
        let startTime = 0;
        let deltaX = 0;
        let dragging = false;
        let verticalLock = false;
        let animating = false;

        function resetStage(animate) {
          stage.style.transition = animate
            ? 'transform 220ms cubic-bezier(.22,.72,.2,1), opacity 220ms ease'
            : 'none';
          stage.style.transform = 'translate3d(0,0,0)';
          stage.style.opacity = '1';
        }

        function changeBySwipe(direction) {
          if (animating) return;
          animating = true;

          const travel = Math.min(
            150,
            Math.max(80, stage.clientWidth * .12)
          );

          stage.style.transition =
            'transform 145ms cubic-bezier(.4,0,1,1), opacity 145ms ease';
          stage.style.transform =
            'translate3d(' + (-direction * travel) + 'px,0,0)';
          stage.style.opacity = '.18';

          window.setTimeout(function () {
            movePatchLightbox(direction);

            stage.style.transition = 'none';
            stage.style.transform =
              'translate3d(' + (direction * travel) + 'px,0,0)';
            stage.style.opacity = '.18';

            requestAnimationFrame(function () {
              requestAnimationFrame(function () {
                stage.style.transition =
                  'transform 240ms cubic-bezier(.22,.72,.2,1), opacity 220ms ease';
                stage.style.transform = 'translate3d(0,0,0)';
                stage.style.opacity = '1';

                window.setTimeout(function () {
                  animating = false;
                  stage.style.transition = '';
                }, 255);
              });
            });
          }, 150);
        }

        stage.addEventListener('pointerdown', function (event) {
          if (animating) return;
          if (event.pointerType === 'mouse' && event.button !== 0) return;

          /* 버튼/입력은 기본 조작 우선.
           * 비디오는 화면 본문에서 좌우 스와이프를 허용하되,
           * 하단 기본 컨트롤 영역(약 56px)은 브라우저 조작을 그대로 둡니다. */
          if (
            event.target.closest(
              'button, a, input, select, textarea'
            )
          ) {
            return;
          }

          const touchedVideo = event.target.closest('video[controls]');
          if (touchedVideo) {
            const videoRect = touchedVideo.getBoundingClientRect();
            const controlReserve = Math.min(64, Math.max(50, videoRect.height * .12));
            if (event.clientY >= videoRect.bottom - controlReserve) {
              return;
            }
          }

          if (patchLightboxState.media.length <= 1) return;

          pointerId = event.pointerId;
          startX = event.clientX;
          startY = event.clientY;
          startTime = performance.now();
          deltaX = 0;
          dragging = false;
          verticalLock = false;
          stage.style.transition = 'none';
        });

        stage.addEventListener('pointermove', function (event) {
          if (pointerId === null || event.pointerId !== pointerId) return;

          const dx = event.clientX - startX;
          const dy = event.clientY - startY;

          if (!dragging && !verticalLock) {
            if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 1.1) {
              verticalLock = true;
              return;
            }

            if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.12) {
              dragging = true;
              stage.classList.add('is-dragging');
              try {
                stage.setPointerCapture(pointerId);
              } catch (err) {}
            }
          }

          if (!dragging || verticalLock) return;

          deltaX = dx;
          event.preventDefault();

          const width = Math.max(1, stage.clientWidth);
          const opacity = Math.max(.58, 1 - Math.abs(dx) / width * .72);
          stage.style.transform = 'translate3d(' + dx + 'px,0,0)';
          stage.style.opacity = String(opacity);
        }, { passive:false });

        function finishSwipe(event) {
          if (pointerId === null || event.pointerId !== pointerId) return;

          const elapsed = Math.max(1, performance.now() - startTime);
          const velocity = deltaX / elapsed;
          const threshold = Math.max(44, stage.clientWidth * .10);
          const wasDragging = dragging;

          try {
            if (
              stage.hasPointerCapture &&
              stage.hasPointerCapture(pointerId)
            ) {
              stage.releasePointerCapture(pointerId);
            }
          } catch (err) {}

          pointerId = null;
          dragging = false;
          verticalLock = false;
          stage.classList.remove('is-dragging');

          if (
            wasDragging &&
            (
              Math.abs(deltaX) >= threshold ||
              Math.abs(velocity) > .42
            )
          ) {
            changeBySwipe(deltaX < 0 ? 1 : -1);
            return;
          }

          resetStage(true);
        }

        stage.addEventListener('pointerup', finishSwipe);
        stage.addEventListener('pointercancel', finishSwipe);
        stage.addEventListener('dragstart', function (event) {
          event.preventDefault();
        });
      }

      const patchLightboxState = {
        media: [],
        index: 0,
        title: ''
      };

      function stopPatchLightboxVideo() {
        const lightbox =
          document.getElementById(
            'calf-patch-lightbox'
          );

        if (!lightbox) return;

        const video =
          lightbox.querySelector(
            '.calf-patch-lightbox-video'
          );

        if (!video) return;

        try {
          video.pause();
        } catch (err) {}

        video.removeAttribute('src');
        video.innerHTML = '';

        try {
          video.load();
        } catch (err) {}

        video.hidden = true;
      }

      function renderPatchLightbox() {
        const lightbox =
          ensurePatchLightbox();

        const media =
          patchLightboxState.media;

        if (!media.length) return;

        patchLightboxState.index =
          (
            patchLightboxState.index +
            media.length
          ) % media.length;

        const current =
          media[patchLightboxState.index];

        const image =
          lightbox.querySelector(
            '.calf-patch-lightbox-image'
          );

        const video =
          lightbox.querySelector(
            '.calf-patch-lightbox-video'
          );

        const caption =
          lightbox.querySelector(
            '.calf-patch-lightbox-caption'
          );

        const prev =
          lightbox.querySelector(
            '[data-calf-lightbox-prev]'
          );

        const next =
          lightbox.querySelector(
            '[data-calf-lightbox-next]'
          );

        /*
         * 항목 전환 시 기존 동영상을 정지합니다.
         * 이미지로 넘어가도 소리만 계속 재생되는 문제를 방지합니다.
         */
        stopPatchLightboxVideo();

        image.hidden = true;
        image.removeAttribute('src');

        if (current.type === 'video') {
          video.hidden = false;
          video.src = current.url;
          video.setAttribute(
            'aria-label',
            patchLightboxState.title +
            ' 패치 영상'
          );

          try {
            video.load();
          } catch (err) {}

          caption.textContent =
            `${patchLightboxState.index + 1} / ${media.length} · VIDEO`;
        } else {
          image.hidden = false;
          image.src = current.url;
          image.alt =
            patchLightboxState.title +
            ' 패치 스크린샷 ' +
            (
              Number(current.imageIndex) +
              1
            );

          caption.textContent =
            `${patchLightboxState.index + 1} / ${media.length}`;
        }

        const multiple =
          media.length > 1;

        prev.hidden = !multiple;
        next.hidden = !multiple;
      }

      function openPatchLightbox(
        media,
        index,
        title
      ) {
        patchLightboxState.media =
          media.map(
            function (entry) {
              return {
                type:
                  entry.type === 'video'
                    ? 'video'
                    : 'image',
                url: entry.url,
                imageIndex:
                  entry.imageIndex
              };
            }
          );

        patchLightboxState.index =
          Number(index) || 0;

        patchLightboxState.title =
          String(title || '패치');

        const lightbox =
          ensurePatchLightbox();

        renderPatchLightbox();

        lightbox.hidden = false;
        document.body.classList.add(
          'calf-lightbox-open'
        );

        const close =
          lightbox.querySelector(
            '.calf-patch-lightbox-close'
          );

        if (close) close.focus();
      }

      function movePatchLightbox(delta) {
        if (
          !patchLightboxState.media.length
        ) {
          return;
        }

        patchLightboxState.index +=
          Number(delta) || 0;

        renderPatchLightbox();
      }

      function closePatchLightbox() {
        const lightbox =
          document.getElementById(
            'calf-patch-lightbox'
          );

        if (!lightbox) return;

        stopPatchLightboxVideo();

        lightbox.hidden = true;

        document.body.classList.remove(
          'calf-lightbox-open'
        );
      }

      function createPatchMediaItem(
        media,
        mediaEntries,
        mediaIndex,
        config
      ) {
        const item =
          document.createElement('div');

        item.className =
          'calf-patch-media-item ' +
          (
            media.type === 'video'
              ? 'is-video'
              : 'is-image'
          );

        if (media.type === 'video') {
          const video =
            document.createElement('video');

          video.className =
            'calf-patch-media-video';

          video.controls = true;
          video.playsInline = true;
          video.preload = 'metadata';

          video.setAttribute(
            'controlslist',
            'nodownload'
          );

          const source =
            document.createElement(
              'source'
            );

          source.src = media.url;

          const mime =
            patchMediaMime(media.url);

          if (mime) {
            source.type = mime;
          }

          video.appendChild(source);

          const fallback =
            document.createElement('a');

          fallback.href = media.url;
          fallback.target = '_blank';
          fallback.rel = 'noopener';
          fallback.textContent =
            '동영상을 새 창에서 열기';

          video.appendChild(fallback);

          video.addEventListener(
            'error',
            function () {
              item.classList.add(
                'is-error'
              );
            }
          );

          const badge =
            document.createElement('span');

          badge.className =
            'calf-patch-video-badge';

          badge.textContent = 'VIDEO';

          item.appendChild(video);
          item.appendChild(badge);

          return item;
        }

        item.tabIndex = 0;
        item.setAttribute(
          'role',
          'button'
        );
        item.setAttribute(
          'aria-label',
          `${config.title} 패치 스크린샷 ${media.imageIndex + 1} 확대`
        );

        const image =
          document.createElement('img');

        image.className =
          'calf-patch-media-image';

        image.src = media.url;
        image.alt =
          `${config.title} 패치 스크린샷 ${media.imageIndex + 1}`;
        image.loading = 'lazy';

        image.addEventListener(
          'error',
          function () {
            item.classList.add(
              'is-error'
            );
            image.remove();
          }
        );

        const zoom =
          document.createElement('span');

        zoom.className =
          'calf-patch-media-zoom';

        zoom.setAttribute(
          'aria-hidden',
          'true'
        );

        zoom.innerHTML = `
          <svg
            viewBox="0 0 24 24"
            focusable="false"
            aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6"></circle>
            <path d="M15 15l5 5"></path>
            <path d="M10.5 7.5v6M7.5 10.5h6"></path>
          </svg>
        `;

        function open() {
          /*
           * 팝업은 이미지를 눌러 열지만,
           * 탐색 목록에는 동영상까지 포함합니다.
           * 동영상은 mediaEntries[0]이므로 팝업에서도 첫 항목입니다.
           */
          openPatchLightbox(
            mediaEntries,
            mediaIndex,
            config.title
          );
        }

        item.addEventListener(
          'click',
          open
        );

        item.addEventListener(
          'keydown',
          function (event) {
            if (
              event.key === 'Enter' ||
              event.key === ' '
            ) {
              event.preventDefault();
              open();
            }
          }
        );

        item.appendChild(image);
        item.appendChild(zoom);

        return item;
      }

      function mountPatchMediaGallery(
        scope,
        config
      ) {
        const host =
          scope.querySelector(
            '[data-calf-patch-media-gallery]'
          );

        if (!host) return;

        const imageUrls =
          config.images
            .map(normalizeImageUrl)
            .filter(Boolean);

        const entries = [];

        const videoUrl =
          normalizeImageUrl(
            config.video
          );

        /*
         * 동영상이 있으면 무조건 전체 미디어의 첫 번째.
         * 따라서 1페이지 좌측 상단을 차지합니다.
         */
        if (videoUrl) {
          entries.push({
            type: 'video',
            url: videoUrl
          });
        }

        imageUrls.forEach(
          function (url, index) {
            entries.push({
              type: 'image',
              url: url,
              imageIndex: index
            });
          }
        );

        if (!entries.length) {
          host.remove();
          return;
        }

        createNextSwipePager(
          host,
          entries,
          function (
            media,
            mediaIndex
          ) {
            return createPatchMediaItem(
              media,
              entries,
              mediaIndex,
              config
            );
          },
          {
            listTag: 'div',
            gridClass:
              'calf-patch-media-page-grid',
            ariaLabel:
              '패치 스크린샷과 영상 페이지',
            pageSizeResolver:
              function () {
                return 4;
              },
            dragOptions: {
              ignoreSelector:
                'video, video *'
            }
          }
        );
      }

      document.addEventListener(
        'keydown',
        function (event) {
          const lightbox =
            document.getElementById(
              'calf-patch-lightbox'
            );

          if (
            !lightbox ||
            lightbox.hidden
          ) {
            return;
          }

          if (event.key === 'Escape') {
            closePatchLightbox();
            return;
          }

          if (event.key === 'ArrowLeft') {
            movePatchLightbox(-1);
            return;
          }

          if (event.key === 'ArrowRight') {
            movePatchLightbox(1);
          }
        }
      );

      function buildCoverImage(config) {
        const url = normalizeImageUrl(config.coverImage);
        if (!url) return '';

        const caption = config.coverCaption
          ? `<figcaption>${esc(config.coverCaption)}</figcaption>`
          : '';

        return `
          <figure class="calf-patch-cover">
            <a href="${esc(url)}" target="_blank" rel="noopener">
              <img
                src="${esc(url)}"
                alt="${esc(config.title + ' 대표 이미지')}"
                loading="lazy"
                onerror="this.closest('.calf-patch-cover').remove();"
              >
            </a>
            ${caption}
          </figure>
        `;
      }

      function mediaIconMarkup(media) {
        const type = ['cartridge', 'cd', 'card'].includes(media) ? media : 'cartridge';

        if (type === 'cd') {
          return `
            <svg class="thumb-media-icon" viewBox="0 0 64 48" focusable="false" aria-hidden="true">
              <circle cx="32" cy="24" r="19"></circle>
              <circle cx="32" cy="24" r="5"></circle>
              <path d="M32 5v14M51 24H37M32 43V29M13 24h14"></path>
            </svg>
          `;
        }

        if (type === 'card') {
          return `
            <svg class="thumb-media-icon" viewBox="0 0 64 48" focusable="false" aria-hidden="true">
              <rect x="13" y="5" width="38" height="38" rx="3"></rect>
              <path d="M20 13h24M20 20h24M20 27h14M20 35h8"></path>
              <path d="M42 29v8M38 33h8"></path>
            </svg>
          `;
        }

        return `
          <svg class="thumb-media-icon" viewBox="0 0 64 48" focusable="false" aria-hidden="true">
            <rect x="11" y="6" width="42" height="34" rx="3"></rect>
            <rect x="17" y="11" width="30" height="12"></rect>
            <path d="M17 32h30M22 40v-6M28 40v-6M36 40v-6M42 40v-6"></path>
          </svg>
        `;
      }

      function setListThumbFallback(thumb, media) {
        if (!thumb) return;
        const type = ['cartridge', 'cd', 'card'].includes(media) ? media : 'cartridge';
        thumb.className = 'thumb media-' + type;
        thumb.innerHTML = mediaIconMarkup(type);
      }

      function setListThumbImage(thumb, imageUrl, media) {
        if (!thumb || !imageUrl) {
          setListThumbFallback(thumb, media);
          return;
        }

        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = '';
        img.loading = 'lazy';

        img.addEventListener('load', function () {
          thumb.className = 'thumb is-image';
        });

        img.addEventListener('error', function () {
          setListThumbFallback(thumb, media);
        });

        thumb.innerHTML = '';
        thumb.appendChild(img);
      }

      async function hydrateOneListThumbnail(item) {
        const link = item.querySelector('a[href]');
        const thumb = item.querySelector('.thumb');
        if (!link || !thumb) return;

        const directImage = (link.dataset.tiaraImage || '').trim();
        if (directImage && directImage !== 'null' && directImage !== 'undefined') {
          setListThumbImage(thumb, directImage, 'cartridge');
          return;
        }

        try {
          const response = await fetch(link.href, {
            credentials: 'same-origin',
            cache: 'no-store'
          });

          if (!response.ok) throw new Error('HTTP ' + response.status);

          const pageHtml = await response.text();
          const doc = new DOMParser().parseFromString(pageHtml, 'text/html');
          const block = doc.querySelector('.calf-patch-auto');

          if (!block) {
            setListThumbFallback(thumb, 'cartridge');
            return;
          }

          const media = (block.dataset.media || 'cartridge').toLowerCase();
          const rawImage =
            block.dataset.thumbnail ||
            block.dataset.image1 ||
            '';

          const imageUrl = normalizeImageUrl(rawImage);
          if (imageUrl) setListThumbImage(thumb, imageUrl, media);
          else setListThumbFallback(thumb, media);
        } catch (err) {
          setListThumbFallback(thumb, 'cartridge');
        }
      }


      function decodedCategoryPath() {
        let path = location.pathname;

        try {
          path = decodeURIComponent(path);
        } catch (err) {}

        return path;
      }

      function isNextCategoryPage() {
        return /^\/category\/NEXT\/?$/i.test(
          decodedCategoryPath()
        );
      }

      function isPatchCategoryPage() {
        return window.calfIsPatchCategoryPath(
          decodedCategoryPath()
        );
      }

      function isHomePage() {
        return decodedCategoryPath() === '/';
      }

      function isHistoryCategoryPage() {
        return (
          /^\/category\/프로젝트 히스토리\/?$/i.test(
            decodedCategoryPath()
          )
        );
      }

      function clampNextProgress(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return 0;
        return Math.max(0, Math.min(100, Math.round(number)));
      }

      function normalizeNextTestState(value) {
        const state = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
        if (['complete','completed','done','완료','테스트완료'].includes(state)) return 'complete';
        if (['progress','testing','inprogress','진행','진행중','테스트중'].includes(state)) return 'progress';
        return 'pending';
      }

      function nextTestMeta(state) {
        /*
         * 상태값(pending/progress/complete)은 기존 데이터 계약을 유지하되,
         * 방문자에게는 출시 임박으로 오해하기 쉬운 '테스트' 표현 대신
         * 프로젝트 전체 상태를 중립적으로 안내합니다.
         */
        if (state === 'complete') return { label: '최종 검수 완료', className: 'is-complete' };
        if (state === 'progress') return { label: '검수 진행 중', className: 'is-progress' };
        return { label: '작업 진행 중', className: 'is-pending' };
      }

      function validNextImage(value) {
        const normalized = normalizeImageUrl(value);
        if (!normalized) return '';
        try {
          const url = new URL(normalized, location.href);
          return ['http:','https:'].includes(url.protocol) ? url.href : '';
        } catch (err) { return ''; }
      }

      function nextProgressRow(label, value, type) {
        const percent = clampNextProgress(value);
        const safeType = ['analysis','translation','review'].includes(type)
          ? type
          : 'analysis';
        const reviewActive =
          safeType === 'review' && percent > 0 && percent < 100;

        return `
          <span class="calf-next-progress-row is-${safeType}">
            <span class="calf-next-progress-track" role="progressbar"
              aria-label="${esc(label + ' 진행률')}" aria-valuemin="0"
              aria-valuemax="100" aria-valuenow="${percent}">
              <span class="calf-next-progress-fill is-${safeType}" style="width:${percent}%"></span>
              <span class="calf-next-progress-text">
                <span class="calf-next-progress-label${reviewActive ? ' is-review-active' : ''}">${esc(label)}</span>
                <strong class="calf-next-progress-value">${percent}%</strong>
              </span>
            </span>
          </span>`;
      }

      function imageUrlFromElement(image) {
        if (!(image instanceof Element)) return '';

        const sourceSet = (
          image.getAttribute('srcset') || ''
        ).trim();

        const sourceSetFirst = sourceSet
          ? sourceSet.split(',')[0].trim().split(/\s+/)[0]
          : '';

        return validNextImage(
          image.getAttribute('data-origin') ||
          image.getAttribute('data-original-url') ||
          image.getAttribute('data-url') ||
          image.getAttribute('data-src') ||
          image.getAttribute('data-lazy-src') ||
          sourceSetFirst ||
          image.getAttribute('src') ||
          ''
        );
      }

      function firstNextBodyImage(doc) {
        const selectors = [
          '#article-view .contents_style img',
          '#article-view figure img',
          '#article-view .imageblock img',
          '#article-view img',
          '.tt_article_useless_p_margin img',
          '.entry-content img',
          '.article-view img',
          '.content.article img'
        ];

        const seen = new Set();

        for (const selector of selectors) {
          const images = Array.from(
            doc.querySelectorAll(selector)
          );

          for (const image of images) {
            if (seen.has(image)) continue;
            seen.add(image);

            /*
             * 설정 블록, 패처 내부, 프로필·댓글 영역 이미지는
             * NEXT 카드 대표 이미지 후보에서 제외합니다.
             */
            if (
              image.closest(
                '.calf-next-project, ' +
                '.calf-patch-auto, ' +
                '.calf-patch-article-source, ' +
                '.comment-wrap, ' +
                '.guestbook-wrap, ' +
                '[data-tistory-react-app="Namecard"]'
              )
            ) {
              continue;
            }

            const imageUrl = imageUrlFromElement(image);
            if (imageUrl) return imageUrl;
          }
        }

        return '';
      }

      function getNextNativeThumbnail(link) {
        if (!(link instanceof Element)) return '';

        const nativeImage = link.querySelector(
          '.calf-next-native-thumbnail'
        );

        if (nativeImage) {
          const nativeUrl = validNextImage(
            nativeImage.currentSrc ||
            nativeImage.getAttribute('src') ||
            ''
          );

          if (nativeUrl) return nativeUrl;
        }

        const tiaraUrl = validNextImage(
          link.dataset.tiaraImage || ''
        );

        if (tiaraUrl) return tiaraUrl;

        return '';
      }

      function fallbackNextImage(doc, link) {
        return getNextNativeThumbnail(link);
      }

      function nextHistoryExcerpt(doc) {
        if (!doc) return '';

        const meta = doc.querySelector(
          'meta[property="og:description"], ' +
          'meta[name="description"]'
        );

        let text = meta
          ? meta.getAttribute('content') || ''
          : '';

        if (!text) {
          const paragraph = doc.querySelector(
            '#article-view p, ' +
            '.tt_article_useless_p_margin p, ' +
            '.entry-content p, ' +
            '.article-view p'
          );

          text = paragraph
            ? paragraph.textContent || ''
            : '';
        }

        text = text
          .replace(/\s+/g, ' ')
          .trim();

        if (text.length > 88) {
          text = text.slice(0, 88).trim() + '…';
        }

        return text;
      }

      function renderNextHistoryCard(item, doc) {
        const link = item.querySelector('a[href]');
        if (!link) return false;

        const titleNode = link.querySelector(
          '.post-text strong'
        );

        const dateNode = link.querySelector(
          '.post-text em'
        );

        const title = (
          link.dataset.tiaraCopy ||
          link.dataset.tiaraName ||
          (
            titleNode
              ? titleNode.textContent
              : ''
          ) ||
          '프로젝트 작업기'
        )
          .replace(/\s+/g, ' ')
          .trim();

        const date = (
          dateNode
            ? dateNode.textContent
            : ''
        )
          .replace(/\s+/g, ' ')
          .trim();

        const image = getNextNativeThumbnail(link);
        const excerpt = nextHistoryExcerpt(doc);

        item.classList.add(
          'calf-next-history-item'
        );

        item.dataset.nextEntryType = 'history';

        link.classList.add(
          'calf-next-history-card'
        );

        const mediaHtml = image
          ? `
            <span class="calf-next-history-media">
              <img
                class="calf-next-history-image"
                src="${esc(image)}"
                alt=""
                loading="lazy"
                draggable="false"
                onerror="this.closest('.calf-next-history-media')?.classList.add('is-image-missing');this.remove();">
              <span class="calf-next-history-kicker">
                PROJECT HISTORY
              </span>
            </span>`
          : `
            <span class="calf-next-history-media is-image-missing">
              <span class="calf-next-history-kicker">
                PROJECT HISTORY
              </span>
              <span class="calf-next-history-placeholder">
                WORK LOG
              </span>
            </span>`;

        link.innerHTML = `
          ${mediaHtml}
          <span class="calf-next-history-body">
            <strong class="calf-next-history-title">
              ${esc(title)}
            </strong>

            ${
              excerpt
                ? `
                  <span class="calf-next-history-excerpt">
                    ${esc(excerpt)}
                  </span>`
                : ''
            }

            <span class="calf-next-history-footer">
              <span class="calf-next-history-date">
                ${esc(date || '작업 기록')}
              </span>
              <span class="calf-next-history-go">
                작업기 읽기 →
              </span>
            </span>
          </span>`;

        return true;
      }

      function nextHistoryCard(post) {
        const imageHtml = post.image
          ? `
            <span class="calf-next-history-media">
              <img
                class="calf-next-history-image"
                src="${esc(post.image)}"
                alt=""
                loading="lazy"
                draggable="false"
                onerror="this.closest('.calf-next-history-media')?.classList.add('is-image-missing');this.remove();">

              <span class="calf-next-history-kicker">
                PROJECT HISTORY
              </span>
            </span>`
          : `
            <span class="calf-next-history-media is-image-missing">
              <span class="calf-next-history-kicker">
                PROJECT HISTORY
              </span>

              <span class="calf-next-history-placeholder">
                WORK LOG
              </span>
            </span>`;

        const commentHtml =
          Number.isFinite(post.comments)
            ? `
              <span class="calf-next-history-comment">
                댓글 ${post.comments}
              </span>`
            : '';

        return `
          <article class="calf-next-history-item">
            <a
              class="calf-next-history-card"
              href="${esc(post.url)}">
              ${imageHtml}

              <span class="calf-next-history-body">
                <strong class="calf-next-history-title">
                  ${esc(post.title)}
                </strong>

                ${
                  post.excerpt
                    ? `
                      <span class="calf-next-history-excerpt">
                        ${esc(post.excerpt)}
                      </span>`
                    : ''
                }

                <span class="calf-next-history-footer">
                  <span class="calf-next-history-date">
                    ${esc(post.date || '작업 기록')}
                  </span>

                  ${commentHtml}

                  <span class="calf-next-history-go">
                    작업기 읽기 →
                  </span>
                </span>
              </span>
            </a>
          </article>`;
      }

      const CALF_PLATFORM_ASSET_ROOT =
        'https://tistory1.daumcdn.net/tistory/5722280/skin/images/';

      const CALF_PLATFORM_META = {
        fc:  { label: '패미컴', short: 'FC' },
        sfc: { label: '슈퍼 패미컴', short: 'SFC' },
        md:  { label: '메가 드라이브', short: 'MD' },
        sms: { label: '세가 마스터 시스템', short: 'SMS' },
        pce: { label: 'PC 엔진', short: 'PCE' },
        gb:  { label: '게임보이', short: 'GB' },
        gbc: { label: '게임보이 컬러', short: 'GBC' },
        gba: { label: '게임보이 어드밴스', short: 'GBA' },
        nds: { label: '닌텐도 DS', short: 'NDS' },
        ps1: { label: '플레이스테이션', short: 'PS1' },
        other: { label: '기타 플랫폼', short: 'ETC' }
      };

      function normalizeCalfPlatformCode(value) {
        const raw = String(value || '')
          .trim()
          .toLowerCase()
          .replace(/[\s._-]+/g, ' ');

        if (!raw) return '';

        const compact = raw.replace(/\s+/g, '');

        if (
          compact === 'fc' ||
          compact === 'famicom' ||
          raw.includes('패미컴') ||
          raw.includes('family computer')
        ) return 'fc';

        if (
          compact === 'sfc' ||
          compact === 'superfamicom' ||
          compact === 'snes' ||
          raw.includes('슈퍼 패미컴') ||
          raw.includes('슈퍼패미컴') ||
          raw.includes('super famicom')
        ) return 'sfc';

        if (
          compact === 'md' ||
          compact === 'megadrive' ||
          raw.includes('메가 드라이브') ||
          raw.includes('메가드라이브') ||
          raw.includes('mega drive')
        ) return 'md';

        if (
          compact === 'sms' ||
          raw.includes('세가 마스터 시스템') ||
          raw.includes('master system')
        ) return 'sms';

        if (
          compact === 'pce' ||
          compact === 'pcengine' ||
          raw.includes('pc 엔진') ||
          raw.includes('pc엔진') ||
          raw.includes('pc engine')
        ) return 'pce';

        if (compact === 'gbc' || raw.includes('게임보이 컬러')) return 'gbc';
        if (compact === 'gba' || raw.includes('게임보이 어드밴스')) return 'gba';
        if (compact === 'gb' || raw === '게임보이' || raw.includes('game boy')) return 'gb';
        if (compact === 'nds' || raw.includes('닌텐도 ds') || compact === 'ds') return 'nds';
        if (
          compact === 'ps1' ||
          compact === 'psx' ||
          raw.includes('플레이스테이션') ||
          raw.includes('playstation')
        ) return 'ps1';

        return '';
      }

      function calfPlatformMeta(code) {
        const safeCode = normalizeCalfPlatformCode(code) ||
          (CALF_PLATFORM_META[code] ? code : 'other');
        return Object.assign(
          { code: safeCode },
          CALF_PLATFORM_META[safeCode] || CALF_PLATFORM_META.other
        );
      }

      function calfPlatformAsset(code, type) {
        const meta = calfPlatformMeta(code);
        if (meta.code === 'other') return '';
        const kind = type === 'wordmark' ? 'wordmark' : 'symbol';

        /* MD symbol v2: same-name CDN cache를 피하기 위해 새 파일명만 사용합니다. */
        if (meta.code === 'md' && kind === 'symbol') {
          return CALF_PLATFORM_ASSET_ROOT +
            'calf-platform-md-symbol-v3.svg';
        }

        return CALF_PLATFORM_ASSET_ROOT +
          'calf-platform-' + meta.code + '-' + kind + '.svg';
      }

      function legacyNextPlatformCode(title) {
        const text = String(title || '').toLowerCase();

        /*
         * V2.0 작성기 이전의 기존 NEXT 글을 위한 1회성 호환 추론.
         * 새 글에서는 data-platform 값이 항상 우선합니다.
         */
        if (
          text.includes('캡틴 츠바사 v') ||
          text.includes('captain tsubasa v')
        ) return 'sfc';

        if (
          text.includes('다운타운 열혈물어') ||
          text.includes('열혈시대극') ||
          text.includes('열혈축구') ||
          text.includes('열혈하키') ||
          text.includes('쿠니오')
        ) return 'fc';

        return '';
      }

      function nextPlatformMark(code) {
        const meta = calfPlatformMeta(code);
        const src = calfPlatformAsset(meta.code, 'symbol');

        if (!src) return '';

        return `
          <span class="calf-next-platform-mark" data-platform="${esc(meta.code)}" title="${esc(meta.label)}">
            <img class="calf-next-platform-symbol" src="${esc(src)}" alt="${esc(meta.label)}" loading="lazy"
              onerror="this.closest('.calf-next-platform-mark')?.classList.add('is-image-missing');this.remove();">
            <span class="calf-next-platform-fallback" aria-hidden="true">${esc(meta.short)}</span>
          </span>`;
      }

      function renderNextProjectCard(item, doc, block) {
        const link=item.querySelector('a[href], a.calf-next-project-card, a');
        if (!link) return false;
        const titleNode=link.querySelector('.post-text strong');
        const dateNode=link.querySelector('.post-text em');
        const originalTitle=(
          link.dataset.nextOriginalTitle ||
          link.dataset.tiaraCopy ||
          (titleNode ? titleNode.textContent : '') ||
          '한글화 프로젝트'
        ).replace(/\s+/g,' ').trim();
        const originalDate=(
          link.dataset.nextOriginalDate ||
          (dateNode ? dateNode.textContent : '')
        ).replace(/\s+/g,' ').trim();
        const title=(block.dataset.projectTitle || originalTitle).trim();
        const analysis=clampNextProgress(block.dataset.analysis);
        const translation=clampNextProgress(block.dataset.translation);
        const review=clampNextProgress(block.dataset.review || block.dataset.verification || 0);
        const platformCode=
          normalizeCalfPlatformCode(block.dataset.platform) ||
          legacyNextPlatformCode(title);
        const testState=normalizeNextTestState(block.dataset.test);
        const test=nextTestMeta(testState);
        const image=
          link.dataset.nextOriginalImage ||
          getNextNativeThumbnail(link);

        item.hidden = false;
        item.classList.add('calf-next-project-item');
        item.classList.remove('is-next-loading');
        item.dataset.nextEntryType='project';
        item.dataset.nextTestState=testState;
        if (platformCode) item.dataset.nextPlatform=platformCode;

        link.classList.add(
          'calf-next-project-card',
          'is-static'
        );
        link.classList.remove('is-loading-placeholder');
        link.removeAttribute('aria-busy');

        link.dataset.nextTestState=testState;
        if (platformCode) link.dataset.nextPlatform=platformCode;
        link.dataset.originalHref=
          link.getAttribute('href') || '';

        link.removeAttribute('href');
        link.removeAttribute('data-tiara-action-name');
        link.removeAttribute('data-tiara-action-kind');
        link.removeAttribute('data-tiara-click-url');
        link.setAttribute('role','group');
        link.setAttribute(
          'aria-label',
          title + ' 진행률'
        );
        link.setAttribute('tabindex','-1');

        const imageHtml=image ? `<img class="calf-next-project-bg" src="${esc(image)}" alt="" loading="lazy" draggable="false" onerror="this.remove();">` : '';
        const dateHtml=originalDate ? `<span class="calf-next-project-date">${esc(originalDate)}</span>` : '';
        const platformHtml=platformCode ? nextPlatformMark(platformCode) : '';

        link.innerHTML=`
          ${imageHtml}
          <span class="calf-next-project-shade" aria-hidden="true"></span>
          <span class="calf-next-project-content">
            <span class="calf-next-project-topline">
              ${platformHtml}
              <span class="calf-next-project-kicker">KOREAN PATCH PROJECT</span>
            </span>
            <strong class="calf-next-project-title">${esc(title)}</strong>
            <span class="calf-next-progress-group">
              ${nextProgressRow('분석',analysis,'analysis')}
              ${nextProgressRow('한글화',translation,'translation')}
              ${nextProgressRow('검수',review,'review')}
            </span>
            <span class="calf-next-project-footer">
              <span class="calf-next-test-badge ${test.className}">${esc(test.label)}</span>
              <span class="calf-next-project-link is-date-only">${dateHtml}</span>
            </span>
          </span>`;
        return true;
      }

      /* =========================================================
         V6.18.76 · NEXT 즉시 표시용 임시 카드
         ---------------------------------------------------------
         상세 글의 진행률 데이터를 기다리는 동안 빈 화면을 만들지 않습니다.
         현재 카테고리 HTML에 이미 있는 제목/날짜/대표이미지로 카드 골격을 먼저
         즉시 그린 뒤, 실제 data-analysis / translation / review가 도착하면
         같은 DOM을 제자리에서 완성 카드로 교체합니다.
         ========================================================= */
      function renderNextProjectPlaceholder(item) {
        const link = item.querySelector('a[href]');
        if (!link) return false;

        const titleNode = link.querySelector('.post-text strong');
        const dateNode = link.querySelector('.post-text em');
        const title = (
          link.dataset.nextOriginalTitle ||
          link.dataset.tiaraCopy ||
          (titleNode ? titleNode.textContent : '') ||
          '한글화 프로젝트'
        ).replace(/\s+/g,' ').trim();
        const date = (
          link.dataset.nextOriginalDate ||
          (dateNode ? dateNode.textContent : '')
        )
          .replace(/\s+/g,' ')
          .trim();
        const image =
          link.dataset.nextOriginalImage ||
          getNextNativeThumbnail(link);
        const platformCode = legacyNextPlatformCode(title);

        /* 임시 카드가 원본 .post-text/.thumbnail DOM을 덮어쓰기 전에 보관 */
        link.dataset.nextOriginalTitle = title;
        link.dataset.nextOriginalDate = date;
        link.dataset.nextOriginalImage = image || '';
        const imageHtml = image
          ? `<img class="calf-next-project-bg" src="${esc(image)}" alt="" loading="eager" draggable="false" onerror="this.remove();">`
          : '';
        const platformHtml = platformCode ? nextPlatformMark(platformCode) : '';
        const dateHtml = date
          ? `<span class="calf-next-project-date">${esc(date)}</span>`
          : '';

        item.classList.add(
          'calf-next-project-item',
          'is-next-loading'
        );
        item.dataset.nextEntryType = 'project';

        link.classList.add(
          'calf-next-project-card',
          'is-static',
          'is-loading-placeholder'
        );
        link.setAttribute('aria-busy','true');
        link.setAttribute('aria-label', title + ' 진행률 불러오는 중');

        link.innerHTML = `
          ${imageHtml}
          <span class="calf-next-project-shade" aria-hidden="true"></span>
          <span class="calf-next-project-content">
            <span class="calf-next-project-topline">
              ${platformHtml}
              <span class="calf-next-project-kicker">KOREAN PATCH PROJECT</span>
            </span>
            <strong class="calf-next-project-title">${esc(title)}</strong>
            <span class="calf-next-progress-group calf-next-progress-placeholder" aria-hidden="true">
              <span class="calf-next-progress-placeholder-row"><i></i></span>
              <span class="calf-next-progress-placeholder-row"><i></i></span>
              <span class="calf-next-progress-placeholder-row"><i></i></span>
            </span>
            <span class="calf-next-project-footer">
              <span class="calf-next-test-badge is-pending">진행률 불러오는 중</span>
              <span class="calf-next-project-link is-date-only">${dateHtml}</span>
            </span>
          </span>`;

        return true;
      }

      async function loadNextProjectItem(item) {
        const link=item.querySelector('a[href]');
        if (!link) return false;
        item.classList.add('is-next-loading');
        try {
          const response=await fetch(link.href,{credentials:'same-origin',cache:'default'});
          if (!response.ok) throw new Error('HTTP '+response.status);
          const doc=new DOMParser().parseFromString(await response.text(),'text/html');
          const block=doc.querySelector('.calf-next-project');

          if (!block) {
            item.dataset.nextEntryType='project';
            return true;
          }

          return renderNextProjectCard(
            item,
            doc,
            block
          );
        } catch (err) {
          item.dataset.nextEntryType='project';
          return true;
        } finally {
          item.classList.remove('is-next-loading');
        }
      }

      const NEXT_PROGRESS_CATEGORY_URL =
        '/category/NEXT';

      const NEXT_COMPLETED_CATEGORY_URL =
        window.CALF_PATCH_CATEGORY.activeUrlEncoded;

      const NEXT_HISTORY_CATEGORY_URL =
        '/category/%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8%20%ED%9E%88%EC%8A%A4%ED%86%A0%EB%A6%AC';

      const NEXT_COMPLETED_MAX_SOURCE_PAGES = 20;

      function normalizeNextCompletedUrl(value) {
        try {
          const url = new URL(
            value || '',
            location.origin
          );

          if (
            !['http:', 'https:'].includes(
              url.protocol
            ) ||
            url.origin !== location.origin
          ) {
            return '';
          }

          return url.href;
        } catch (err) {
          return '';
        }
      }

      function nextCompletedThumbnail(item, link) {
        const nativeImage = item.querySelector(
          '.calf-next-native-thumbnail'
        );

        if (nativeImage) {
          const nativeUrl = validNextImage(
            nativeImage.currentSrc ||
            nativeImage.getAttribute('src') ||
            ''
          );

          if (nativeUrl) return nativeUrl;
        }

        const tiaraUrl = validNextImage(
          link.dataset.tiaraImage || ''
        );

        if (tiaraUrl) return tiaraUrl;

        const visibleImage = item.querySelector(
          '.thumb img, img.thumb, .post-item img'
        );

        if (visibleImage) {
          return validNextImage(
            visibleImage.currentSrc ||
            visibleImage.getAttribute('src') ||
            visibleImage.getAttribute('data-src') ||
            ''
          );
        }

        return '';
      }

      function nextCompletedCommentCount(item) {
        const selectors = [
          '.c_cnt',
          '.comment-count',
          '.comments-count',
          '[class*="comment"][class*="count"]',
          '.post-text strong span'
        ];

        for (const selector of selectors) {
          const node = item.querySelector(selector);
          if (!node) continue;

          const match = (
            node.textContent || ''
          ).match(/\d+/);

          if (match) return Number(match[0]);
        }

        return null;
      }

      function parseNextCompletedItems(doc) {
        const items = Array.from(
          doc.querySelectorAll(
            '.list-card .post-list > .post-item'
          )
        );

        return items
          .map(function (item) {
            const link = item.querySelector(
              'a[href]'
            );

            if (!link) return null;

            const url = normalizeNextCompletedUrl(
              link.getAttribute('href') ||
              link.href
            );

            if (!url) return null;

            const titleNode = link.querySelector(
              '.post-text strong'
            );

            const dateNode = link.querySelector(
              '.post-text em'
            );

            const title = (
              link.dataset.tiaraCopy ||
              link.dataset.tiaraName ||
              (
                titleNode
                  ? titleNode.textContent
                  : ''
              ) ||
              ''
            )
              .replace(/\s+/g, ' ')
              .trim();

            if (!title) return null;

            const date = (
              dateNode
                ? dateNode.textContent
                : ''
            )
              .replace(/\s+/g, ' ')
              .trim();

            return {
              url: url,
              title: title,
              date: date,
              image: nextCompletedThumbnail(
                item,
                link
              ),
              comments:
                nextCompletedCommentCount(item)
            };
          })
          .filter(Boolean);
      }

      async function collectCategoryItems(
        categoryUrl,
        categoryLabel
      ) {
        const collected = [];
        const seen = new Set();
        let expectedPageSize = 0;

        for (
          let page = 1;
          page <= NEXT_COMPLETED_MAX_SOURCE_PAGES;
          page += 1
        ) {
          const url = new URL(
            categoryUrl,
            location.origin
          );

          url.searchParams.set(
            'page',
            String(page)
          );

          const response = await fetch(url.href, {
            credentials: 'same-origin',
            cache: 'default'
          });

          if (!response.ok) {
            if (page === 1) {
              throw new Error(
                categoryLabel +
                ' 카테고리 HTTP ' +
                response.status
              );
            }

            break;
          }

          const rawHtml =
            await response.text();

          const doc =
            new DOMParser().parseFromString(
              rawHtml,
              'text/html'
            );

          const pageItems =
            parseNextCompletedItems(doc);

          if (!pageItems.length) break;

          if (!expectedPageSize) {
            expectedPageSize =
              pageItems.length;
          }

          let added = 0;

          pageItems.forEach(function (post) {
            if (seen.has(post.url)) return;

            seen.add(post.url);
            collected.push(post);
            added += 1;
          });

          /*
           * 티스토리가 범위를 넘은 page에서
           * 마지막 페이지를 반복하는 경우 종료합니다.
           */
          if (!added) break;

          if (
            expectedPageSize > 0 &&
            pageItems.length <
              expectedPageSize
          ) {
            break;
          }
        }

        return collected;
      }

      async function collectNextCompletedItems() {
        return collectCategoryItems(
          NEXT_COMPLETED_CATEGORY_URL,
          '한글 패치'
        );
      }

      async function collectNextHistoryItems() {
        const posts = await collectCategoryItems(
          NEXT_HISTORY_CATEGORY_URL,
          '프로젝트 히스토리'
        );

        /*
         * 카테고리 목록에는 본문 요약이 없으므로
         * 각 작업기 페이지의 description을 읽어 옵니다.
         */
        return Promise.all(
          posts.map(async function (post) {
            try {
              const response = await fetch(
                post.url,
                {
                  credentials: 'same-origin',
                  cache: 'default'
                }
              );

              if (!response.ok) return post;

              const doc =
                new DOMParser().parseFromString(
                  await response.text(),
                  'text/html'
                );

              return Object.assign(
                {},
                post,
                {
                  excerpt:
                    nextHistoryExcerpt(doc)
                }
              );
            } catch (err) {
              return post;
            }
          })
        );
      }

      function nextCompletedPlaceholder() {
        return `
          <span
            class="calf-next-completed-placeholder"
            aria-hidden="true">
            <svg
              viewBox="0 0 64 48"
              focusable="false">
              <rect
                x="11"
                y="6"
                width="42"
                height="34"
                rx="3">
              </rect>
              <rect
                x="17"
                y="11"
                width="30"
                height="12">
              </rect>
              <path
                d="M17 32h30M22 40v-6M28 40v-6M36 40v-6M42 40v-6">
              </path>
            </svg>
          </span>`;
      }

      function nextCompletedCard(post) {
        const imageHtml = post.image
          ? `
            <img
              class="calf-next-completed-image"
              src="${esc(post.image)}"
              alt=""
              loading="lazy"
              draggable="false"
              onerror="this.closest('.calf-next-completed-media')?.classList.add('is-image-missing');this.remove();">`
          : nextCompletedPlaceholder();

        const commentHtml =
          Number.isFinite(post.comments)
            ? `
              <span
                class="calf-next-completed-comment"
                aria-label="댓글 ${post.comments}개">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true">
                  <path
                    d="M5 5h14v10H9l-4 4z">
                  </path>
                </svg>
                ${post.comments}
              </span>`
            : '';

        return `
          <article
            class="calf-next-completed-item">
            <a
              class="calf-next-completed-card"
              href="${esc(post.url)}">
              <span
                class="calf-next-completed-media">
                ${imageHtml}
                <span
                  class="calf-next-completed-badge">
                  <strong>
                    한글패치 완료
                  </strong>
                  <small>
                    PATCH COMPLETE
                  </small>
                </span>
              </span>

              <span
                class="calf-next-completed-body">
                <strong
                  class="calf-next-completed-title">
                  ${esc(post.title)}
                </strong>

                <span
                  class="calf-next-completed-meta">
                  <span
                    class="calf-next-completed-date">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true">
                      <rect
                        x="4"
                        y="6"
                        width="16"
                        height="14">
                      </rect>
                      <path
                        d="M8 3v6M16 3v6M4 10h16">
                      </path>
                    </svg>
                    ${esc(
                      post.date ||
                      '배포 완료'
                    )}
                  </span>
                  ${commentHtml}
                </span>

                <span
                  class="calf-next-completed-go">
                  바로가기 →
                </span>
              </span>
            </a>
          </article>`;
      }

      function nextCardsPerPage() {
        /*
         * 진행 프로젝트 / 프로젝트 히스토리
         * PC: 3열 x 2행 = 6개
         * 태블릿: 2열 x 2행 = 4개
         * 모바일: 1열 x 3행 = 3개
         */
        if (
          window.matchMedia(
            '(max-width:620px)'
          ).matches
        ) {
          return 3;
        }

        if (
          window.matchMedia(
            '(max-width:900px)'
          ).matches
        ) {
          return 4;
        }

        return 6;
      }

      function nextArchiveCardsPerPage() {
        /* 한글화 아카이브: PC 3열 x 1행 / 태블릿 2장 / 모바일 1장 */
        if (
          window.matchMedia(
            '(max-width:620px)'
          ).matches
        ) {
          return 1;
        }

        if (
          window.matchMedia(
            '(max-width:900px)'
          ).matches
        ) {
          return 2;
        }

        return 3;
      }

      function nextNodeFromHtml(htmlText) {
        const template =
          document.createElement('template');

        template.innerHTML =
          String(htmlText || '').trim();

        return (
          template.content
            .firstElementChild || null
        );
      }

      function attachNextDragSurface(
        viewport,
        track,
        getPage,
        getPageCount,
        goToPage,
        options
      ) {
        const config = options || {};
        let pointerId = null;
        let pointerType = '';
        let startX = 0;
        let startY = 0;
        let dragAnchorX = 0;
        let deltaX = 0;
        let dragging = false;
        let verticalLock = false;
        let suppressClick = false;
        let dragBaseOffset = 0;
        let dragStep = 1;
        let pendingOffset = 0;
        let dragFrame = 0;
        let lastSampleX = 0;
        let lastSampleTime = 0;
        let swipeVelocity = 0;

        function trackGap() {
          if (!track) return 0;

          const style = window.getComputedStyle(track);
          const value = parseFloat(
            style.columnGap ||
            style.gap ||
            '0'
          );

          return Number.isFinite(value)
            ? value
            : 0;
        }

        function pageStep() {
          const slide =
            track &&
            track.firstElementChild;

          if (!slide) {
            return Math.max(
              1,
              viewport.clientWidth
            );
          }

          return Math.max(
            1,
            slide.getBoundingClientRect().width +
              trackGap()
          );
        }

        function maxOffset() {
          if (!track || !viewport) return 0;

          return Math.max(
            0,
            track.scrollWidth -
              viewport.clientWidth
          );
        }

        function pageOffset(index) {
          return Math.min(
            Math.max(0, Number(index) || 0) *
              pageStep(),
            maxOffset()
          );
        }

        function currentTranslateX() {
          if (!track) return 0;

          const value =
            window.getComputedStyle(track)
              .transform;

          if (!value || value === 'none') {
            return -pageOffset(getPage());
          }

          try {
            return new DOMMatrixReadOnly(value).m41;
          } catch (err) {
            const match = value.match(
              /^matrix\(([^)]+)\)$/
            );

            if (match) {
              const parts = match[1]
                .split(',')
                .map(Number);

              if (parts.length >= 6) {
                return Number(parts[4]) || 0;
              }
            }
          }

          return -pageOffset(getPage());
        }

        function hasActiveTrackMotion() {
          if (
            !track ||
            typeof track.getAnimations !== 'function'
          ) {
            return false;
          }

          try {
            return track
              .getAnimations()
              .some(function (animation) {
                return animation.playState === 'running';
              });
          } catch (err) {
            return false;
          }
        }

        function freezeAtCurrentVisualPosition() {
          let base = pageOffset(getPage());

          /*
           * 평상시에는 getComputedStyle(transform)을 읽지 않는다.
           * 전환 중인 카드를 다시 잡았을 때만 현재 합성 위치를 한 번 읽어
           * 그 자리에서 자연스럽게 이어 잡는다. PC 첫 클릭의 layout flush를 줄인다.
           */
          if (hasActiveTrackMotion()) {
            const currentX = currentTranslateX();
            base = Math.min(
              maxOffset(),
              Math.max(0, -currentX)
            );
            track.style.transition = 'none';
            track.style.transform =
              `translate3d(${-base}px,0,0)`;
          } else {
            track.style.transition = 'none';
          }

          return base;
        }

        function paintDrag(offset) {
          let adjusted = offset;
          const page = getPage();
          const count = getPageCount();

          if (
            (page === 0 && offset > 0) ||
            (
              page === count - 1 &&
              offset < 0
            )
          ) {
            /* 끝에서는 딱딱하게 막지 않고 짧은 rubber-band만 허용 */
            adjusted *= .3;
          }

          track.style.transform =
            `translate3d(${
              -dragBaseOffset + adjusted
            }px,0,0)`;
        }

        function scheduleDrag(offset) {
          pendingOffset = offset;

          if (dragFrame) return;

          dragFrame =
            window.requestAnimationFrame(
              function () {
                dragFrame = 0;
                paintDrag(pendingOffset);
              }
            );
        }

        function activationThreshold() {
          if (pointerType === 'mouse') return 4;
          if (pointerType === 'pen') return 5;
          return 7;
        }

        viewport.addEventListener(
          'pointerdown',
          function (event) {
            if (
              event.pointerType === 'mouse' &&
              event.button !== 0
            ) {
              return;
            }

            if (
              config.ignoreSelector &&
              event.target.closest(
                config.ignoreSelector
              )
            ) {
              return;
            }

            if (getPageCount() <= 1) return;

            pointerId = event.pointerId;
            pointerType = event.pointerType || 'mouse';
            startX = event.clientX;
            startY = event.clientY;
            dragAnchorX = startX;
            deltaX = 0;
            dragging = false;
            verticalLock = false;
            dragStep = pageStep();
            dragBaseOffset = pageOffset(getPage());
            pendingOffset = 0;
            lastSampleX = startX;
            lastSampleTime = performance.now();
            swipeVelocity = 0;

            /* pointerdown에서는 transform을 건드리지 않는다. 클릭 시작 시 '뚝' 방지 */
          }
        );

        viewport.addEventListener(
          'pointermove',
          function (event) {
            if (
              pointerId === null ||
              event.pointerId !== pointerId
            ) {
              return;
            }

            const samples =
              typeof event.getCoalescedEvents ===
              'function'
                ? event.getCoalescedEvents()
                : null;

            const sample =
              samples && samples.length
                ? samples[samples.length - 1]
                : event;

            const totalDx =
              sample.clientX - startX;

            const totalDy =
              sample.clientY - startY;

            const threshold = activationThreshold();

            if (
              !dragging &&
              !verticalLock
            ) {
              if (
                Math.abs(totalDy) > threshold + 2 &&
                Math.abs(totalDy) >
                  Math.abs(totalDx) * 1.08
              ) {
                verticalLock = true;
                return;
              }

              if (
                Math.abs(totalDx) >= threshold &&
                Math.abs(totalDx) >
                  Math.abs(totalDy) * 1.04
              ) {
                dragging = true;
                dragBaseOffset =
                  freezeAtCurrentVisualPosition();

                /*
                 * 활성화 임계값을 넘는 순간 기존 4~7px를 한꺼번에 적용하지 않는다.
                 * 현재 포인터 위치를 새 0점으로 삼아 PC에서 느껴지던 첫 '툭'을 제거한다.
                 */
                dragAnchorX = sample.clientX;
                deltaX = 0;
                pendingOffset = 0;
                lastSampleX = sample.clientX;
                lastSampleTime = performance.now();
                swipeVelocity = 0;

                try {
                  viewport.setPointerCapture(
                    pointerId
                  );
                } catch (err) {}

                viewport.classList.add(
                  'is-dragging'
                );

                event.preventDefault();
                return;
              }
            }

            if (
              verticalLock ||
              !dragging
            ) {
              return;
            }

            const now = performance.now();
            const dx =
              sample.clientX - dragAnchorX;
            const dt = Math.max(
              1,
              now - lastSampleTime
            );
            const instantVelocity =
              (sample.clientX - lastSampleX) / dt;

            /* 최근 속도를 부드럽게 섞어 휙 넘김과 느린 끌기의 감각을 모두 보존 */
            swipeVelocity =
              swipeVelocity * .68 +
              instantVelocity * .32;

            lastSampleX = sample.clientX;
            lastSampleTime = now;
            deltaX = dx;

            event.preventDefault();
            scheduleDrag(deltaX);
          },
          { passive: false }
        );

        function endDrag(event) {
          if (
            pointerId === null ||
            event.pointerId !== pointerId
          ) {
            return;
          }

          const wasDragging = dragging;
          const threshold = dragStep * .13;
          const projected =
            deltaX + swipeVelocity * 130;

          let target = getPage();

          if (
            wasDragging &&
            Math.abs(projected) > threshold
          ) {
            target += projected < 0 ? 1 : -1;
          }

          if (dragFrame) {
            window.cancelAnimationFrame(
              dragFrame
            );
            dragFrame = 0;
            paintDrag(deltaX);
          }

          viewport.classList.remove(
            'is-dragging'
          );

          try {
            if (
              viewport.hasPointerCapture &&
              viewport.hasPointerCapture(
                pointerId
              )
            ) {
              viewport.releasePointerCapture(
                pointerId
              );
            }
          } catch (err) {}

          pointerId = null;
          pointerType = '';
          dragging = false;
          verticalLock = false;
          swipeVelocity = 0;

          if (wasDragging) {
            suppressClick = true;

            window.setTimeout(
              function () {
                suppressClick = false;
              },
              110
            );
          }

          goToPage(target, true);
        }

        viewport.addEventListener(
          'pointerup',
          endDrag
        );

        viewport.addEventListener(
          'pointercancel',
          endDrag
        );

        viewport.addEventListener(
          'click',
          function (event) {
            if (!suppressClick) return;

            event.preventDefault();
            event.stopPropagation();
          },
          true
        );

        viewport.addEventListener(
          'dragstart',
          function (event) {
            event.preventDefault();
          }
        );
      }

      /* V6.18.40: 저지연 rAF + GPU transform 기반 FLUID SWIPE 공용 엔진 */
      function createNextSwipePager(
        host,
        entries,
        renderEntry,
        options
      ) {
        const config = options || {};

        const resolvePageSize =
          typeof config.pageSizeResolver ===
          'function'
            ? config.pageSizeResolver
            : nextCardsPerPage;

        let page = 0;
        let pageSize = resolvePageSize();
        let pageCount = 1;
        let viewport = null;
        let track = null;
        let dots = null;
        let prevButton = null;
        let nextButton = null;
        let resizeTimer = null;

        function trackGap() {
          if (!track) return 0;

          const style =
            window.getComputedStyle(track);

          const value = parseFloat(
            style.columnGap ||
            style.gap ||
            '0'
          );

          return Number.isFinite(value)
            ? value
            : 0;
        }

        function pageStep() {
          const slide =
            track && track.firstElementChild;

          if (!slide) {
            return Math.max(
              1,
              viewport ? viewport.clientWidth : 1
            );
          }

          return Math.max(
            1,
            slide.getBoundingClientRect().width +
              trackGap()
          );
        }

        function maxTrackOffset() {
          if (!track || !viewport) return 0;

          return Math.max(
            0,
            track.scrollWidth -
              viewport.clientWidth
          );
        }

        function pageOffset(target) {
          return Math.min(
            Math.max(0, Number(target) || 0) *
              pageStep(),
            maxTrackOffset()
          );
        }

        function updateControls(animate) {
          if (!track || !viewport) return;

          page = Math.max(
            0,
            Math.min(
              page,
              pageCount - 1
            )
          );

          track.style.transition = animate
            ? 'transform .41s cubic-bezier(.16,1,.3,1)'
            : 'none';

          track.style.transform =
            `translate3d(${-pageOffset(page)}px,0,0)`;

          if (prevButton) {
            prevButton.disabled =
              page <= 0;
          }

          if (nextButton) {
            nextButton.disabled =
              page >= pageCount - 1;
          }

          if (dots) {
            dots
              .querySelectorAll(
                '[data-next-page]'
              )
              .forEach(function (button) {
                const target = Number(
                  button.dataset.nextPage
                );

                const active =
                  target === page;

                button.classList.toggle(
                  'is-active',
                  active
                );

                button.setAttribute(
                  'aria-current',
                  active
                    ? 'page'
                    : 'false'
                );
              });
          }

          if (
            typeof config.onPageChange ===
            'function'
          ) {
            config.onPageChange(page);
          }
        }

        function goToPage(
          target,
          animate
        ) {
          page = Math.max(
            0,
            Math.min(
              Number(target) || 0,
              pageCount - 1
            )
          );

          updateControls(animate !== false);
        }

        function createPageGrid() {
          const grid = document.createElement(
            config.listTag || 'div'
          );

          grid.className =
            config.gridClass ||
            'calf-next-swipe-page-grid';

          return grid;
        }

        function build() {
          const firstVisibleIndex =
            page * pageSize;

          pageSize =
            resolvePageSize();

          pageCount = Math.max(
            1,
            Math.ceil(
              entries.length /
              pageSize
            )
          );

          page = Math.min(
            pageCount - 1,
            Math.floor(
              firstVisibleIndex /
              pageSize
            )
          );

          host.innerHTML = '';

          const root =
            document.createElement('div');

          root.className =
            'calf-next-swipe-pager';

          if (
            config.peek &&
            pageCount > 1
          ) {
            root.classList.add(
              'has-next-peek'
            );
          }

          viewport =
            document.createElement('div');

          viewport.className =
            'calf-next-swipe-viewport';

          viewport.setAttribute(
            'aria-label',
            config.ariaLabel ||
            '프로젝트 페이지'
          );

          track =
            document.createElement('div');

          track.className =
            'calf-next-swipe-track';

          for (
            let index = 0;
            index < pageCount;
            index += 1
          ) {
            const slide =
              document.createElement(
                'div'
              );

            slide.className =
              'calf-next-swipe-page';

            slide.setAttribute(
              'aria-label',
              `${index + 1} / ${pageCount}`
            );

            const grid =
              createPageGrid();

            entries
              .slice(
                index * pageSize,
                index * pageSize +
                  pageSize
              )
              .forEach(
                function (
                  entry,
                  itemIndex
                ) {
                  const rendered =
                    renderEntry(
                      entry,
                      index *
                        pageSize +
                        itemIndex
                    );

                  if (rendered) {
                    grid.appendChild(
                      rendered
                    );
                  }
                }
              );

            const renderedCount =
              grid.children.length;

            grid.dataset.itemCount =
              String(renderedCount);

            if (
              config.centerShortPage &&
              renderedCount > 0 &&
              renderedCount < pageSize
            ) {
              grid.classList.add(
                'is-short-page',
                'is-short-' + renderedCount
              );
            }

            slide.appendChild(grid);
            track.appendChild(slide);
          }

          viewport.appendChild(track);
          root.appendChild(viewport);

          if (pageCount > 1) {
            const controls =
              document.createElement(
                'div'
              );

            controls.className =
              'calf-next-swipe-controls';

            prevButton =
              document.createElement(
                'button'
              );

            prevButton.type =
              'button';

            prevButton.className =
              'calf-next-swipe-arrow is-prev';

            prevButton.setAttribute(
              'aria-label',
              '이전 페이지'
            );

            prevButton.textContent = '‹';

            dots =
              document.createElement(
                'div'
              );

            dots.className =
              'calf-next-swipe-dots';

            for (
              let index = 0;
              index < pageCount;
              index += 1
            ) {
              const dot =
                document.createElement(
                  'button'
                );

              dot.type = 'button';
              dot.className =
                'calf-next-swipe-dot';

              dot.dataset.nextPage =
                String(index);

              dot.setAttribute(
                'aria-label',
                `${index + 1}페이지`
              );

              dot.addEventListener(
                'click',
                function () {
                  goToPage(
                    index,
                    true
                  );
                }
              );

              dots.appendChild(dot);
            }

            nextButton =
              document.createElement(
                'button'
              );

            nextButton.type =
              'button';

            nextButton.className =
              'calf-next-swipe-arrow is-next';

            nextButton.setAttribute(
              'aria-label',
              '다음 페이지'
            );

            nextButton.textContent = '›';

            prevButton.addEventListener(
              'click',
              function () {
                goToPage(
                  page - 1,
                  true
                );
              }
            );

            nextButton.addEventListener(
              'click',
              function () {
                goToPage(
                  page + 1,
                  true
                );
              }
            );

            controls.appendChild(
              prevButton
            );

            controls.appendChild(dots);

            controls.appendChild(
              nextButton
            );

            root.appendChild(controls);
          } else {
            dots = null;
            prevButton = null;
            nextButton = null;
          }

          if (config.prewarmMedia) {
            root
              .querySelectorAll('img')
              .forEach(function (image, imageIndex) {
                image.decoding = 'async';

                /* 첫 화면 + 다음 화면은 미리 decode해 첫 드래그 시 이미지 디코딩 끊김 방지 */
                if (imageIndex < pageSize * 2) {
                  image.loading = 'eager';
                }

                if (
                  image.complete &&
                  typeof image.decode === 'function'
                ) {
                  image.decode().catch(function () {});
                }
              });
          }

          host.appendChild(root);

          attachNextDragSurface(
            viewport,
            track,
            function () {
              return page;
            },
            function () {
              return pageCount;
            },
            goToPage,
            config.dragOptions || null
          );

          requestAnimationFrame(
            function () {
              goToPage(page, false);
            }
          );
        }

        function resize() {
          window.clearTimeout(
            resizeTimer
          );

          resizeTimer =
            window.setTimeout(
              function () {
                const nextSize =
                  resolvePageSize();

                if (
                  nextSize !== pageSize
                ) {
                  build();
                } else {
                  goToPage(
                    page,
                    false
                  );
                }
              },
              140
            );
        }

        window.addEventListener(
          'resize',
          resize
        );

        build();

        return {
          rebuild: build,
          goToPage: goToPage,
          getPage: function () {
            return page;
          },
          getPageCount:
            function () {
              return pageCount;
            }
        };
      }

      function nextProjectEmpty(message) {
        const empty =
          document.createElement('div');

        empty.className =
          'calf-next-project-empty';

        empty.textContent = message;

        return empty;
      }

      function nextPanelHeading(
        kicker,
        title,
        description,
        count
      ) {
        return `
          <header
            class="calf-next-panel-heading">
            <span
              class="calf-next-panel-kicker">
              ${esc(kicker)}
            </span>
            <div
              class="calf-next-panel-title-row">
              <h3>
                ${esc(title)}
              </h3>
              <span
                class="calf-next-panel-count">
                ${Number(count) || 0}
              </span>
            </div>
            <p>
              ${esc(description)}
            </p>
          </header>`;
      }

      function createNextDashboard(
        card,
        list,
        projectItems,
        initialCounts
      ) {
        const pageTitle =
          card.querySelector('.page-title');

        /*
         * NEXT 컴팩트 헤더
         * 기존에는 NEXT / IN PROGRESS / 진행 중 프로젝트 / 설명이
         * 여러 줄을 차지했습니다. 이들을 한 줄(모바일은 최대 두 줄)로
         * 합쳐 프로젝트 카드가 화면에 더 많이 보이게 합니다.
         */
        const compactHeader =
          document.createElement('header');

        compactHeader.className =
          'calf-compact-section-head calf-next-compact-head';

        const pageTitleText =
          pageTitle && pageTitle.textContent
            ? pageTitle.textContent.trim()
            : 'NEXT';

        compactHeader.innerHTML = `
          <h2 class="page-title calf-compact-section-page-title">
            ${esc(pageTitleText)}
          </h2>
          <span class="calf-compact-section-separator" aria-hidden="true"></span>
          <span class="calf-next-panel-kicker calf-compact-section-kicker">
            IN PROGRESS
          </span>
          <strong
            class="calf-compact-section-subtitle"
            data-next-view-target="active"
            role="button"
            tabindex="0"
            aria-pressed="true"
            title="진행 중 프로젝트 보기">
            진행 중 프로젝트
          </strong>
          <span
            class="calf-next-panel-count"
            data-next-active-count
            data-next-view-target="active"
            role="button"
            tabindex="0"
            aria-pressed="true"
            title="진행 중 프로젝트 보기">
            ${initialCounts && Number.isFinite(initialCounts.active)
              ? initialCounts.active
              : '…'}
          </span>
          <span aria-hidden="true">/</span>
          <strong
            class="calf-compact-section-subtitle"
            data-next-view-target="complete"
            role="button"
            tabindex="0"
            aria-pressed="false"
            title="완료된 프로젝트 보기">
            완료된 프로젝트
          </strong>
          <span
            class="calf-next-panel-count"
            data-next-complete-count
            data-next-view-target="complete"
            role="button"
            tabindex="0"
            aria-pressed="false"
            title="완료된 프로젝트 보기">
            ${initialCounts && Number.isFinite(initialCounts.complete)
              ? initialCounts.complete
              : '…'}
          </span>
          <span class="calf-compact-section-separator" aria-hidden="true"></span>
          <p class="calf-compact-section-desc">
            분석·한글화·검수·진행률 현황판
          </p>`;

        /* 기존 NEXT 제목은 새 컴팩트 헤더 안에서 다시 그리므로 제거합니다. */
        if (pageTitle) pageTitle.remove();

        const dashboard =
          document.createElement('div');

        dashboard.className =
          'calf-next-tab-dashboard ' +
          'calf-next-project-only-dashboard';

        dashboard.innerHTML = `
          <section
            class="calf-next-tab-panel calf-next-project-only-panel"
            data-next-panel="projects">
            <div
              class="calf-next-project-pager-host"
              data-next-project-host="projects">
            </div>
          </section>

          <section class="calf-next-release-link-panel" aria-label="배포 완료 한글패치 바로가기">
            <a
              class="calf-next-release-famicom-button"
              href="${NEXT_COMPLETED_CATEGORY_URL}">
              <span class="calf-next-release-famicom-kicker">PATCH ARCHIVE</span>
              <strong class="calf-next-release-famicom-title">배포 완료 한글패치 보기</strong>
              <span class="calf-next-release-famicom-arrow" aria-hidden="true">▶</span>
            </a>
          </section>
        `;

        /*
         * 컴팩트 헤더를 카드 최상단에 배치하고,
         * 그 바로 아래에 실제 NEXT 프로젝트 대시보드를 붙입니다.
         */
        card.insertBefore(
          compactHeader,
          card.firstChild
        );

        compactHeader.insertAdjacentElement(
          'afterend',
          dashboard
        );

        list.remove();

        const projectHost =
          dashboard.querySelector(
            '[data-next-project-host="projects"]'
          );

        let projectPager = null;

        const visibleProjectItems =
          projectItems.filter(function (item) {
            return (
              item.dataset.nextTestState !==
              'complete'
            );
          });

        if (visibleProjectItems.length) {
          projectPager = createNextSwipePager(
            projectHost,
            visibleProjectItems,
            function (item) {
              return item;
            },
            {
              listTag: 'ul',
              gridClass:
                'post-list ' +
                'calf-next-progress-list ' +
                'calf-next-project-page-grid',
              ariaLabel:
                '진행 중 프로젝트 페이지'
            }
          );
        } else {
          projectHost.appendChild(
            nextProjectEmpty(
              '현재 등록된 진행률 프로젝트가 없습니다.'
            )
          );
        }

        return {
          dashboard: dashboard,
          updateHeight: function () {},
          releaseHost: null,
          releaseCount: null,
          projectHost: projectHost,
          projectPager: projectPager,
          visibleProjectItems: visibleProjectItems,
          nextProjectView: 'active'
        };
      }

      async function hydrateNextHistoryArchive(
        controller
      ) {
        if (
          !controller ||
          !controller.historyHost
        ) {
          return;
        }

        try {
          const posts =
            await collectNextHistoryItems();

          controller.historyHost.innerHTML =
            '';

          if (controller.historyTabCount) {
            controller.historyTabCount.textContent =
              String(posts.length);
          }

          if (controller.historyPanelCount) {
            controller.historyPanelCount.textContent =
              String(posts.length);
          }

          if (!posts.length) {
            controller.historyHost.appendChild(
              nextProjectEmpty(
                '아직 프로젝트 히스토리 카테고리에 등록된 작업기가 없습니다.'
              )
            );

            controller.updateHeight();
            return;
          }

          createNextSwipePager(
            controller.historyHost,
            posts,
            function (post) {
              return nextNodeFromHtml(
                nextHistoryCard(post)
              );
            },
            {
              gridClass:
                'calf-next-history-page-grid',
              ariaLabel:
                '프로젝트 히스토리 페이지',
              onPageChange:
                controller.updateHeight
            }
          );

          controller.updateHeight();
        } catch (err) {
          console.warn(
            '[CALF NEXT] 프로젝트 히스토리 로드 실패',
            err
          );

          controller.historyHost.innerHTML =
            '';

          controller.historyHost.appendChild(
            nextProjectEmpty(
              '프로젝트 히스토리를 불러오지 못했습니다.'
            )
          );

          controller.updateHeight();
        }
      }

      async function hydrateNextReleaseArchive(
        controller
      ) {
        if (
          !controller ||
          !controller.releaseHost
        ) {
          return;
        }

        try {
          const posts =
            await collectNextCompletedItems();

          controller.releaseHost.innerHTML =
            '';

          if (controller.releaseCount) {
            controller.releaseCount.textContent =
              String(posts.length);
          }

          if (!posts.length) {
            controller.releaseHost.appendChild(
              nextProjectEmpty(
                '아직 배포된 한글패치가 없습니다.'
              )
            );

            controller.updateHeight();
            return;
          }

          createNextSwipePager(
            controller.releaseHost,
            posts,
            function (post) {
              return nextNodeFromHtml(
                nextCompletedCard(post)
              );
            },
            {
              gridClass:
                'calf-next-completed-page-grid',
              ariaLabel:
                '배포 완료 한글패치 페이지',
              pageSizeResolver:
                nextArchiveCardsPerPage,
              peek: true,
              prewarmMedia: true,
              onPageChange:
                controller.updateHeight
            }
          );

          controller.updateHeight();
        } catch (err) {
          console.warn(
            '[CALF NEXT] 완료작 목록 로드 실패',
            err
          );

          controller.releaseHost.innerHTML =
            '';

          controller.releaseHost.appendChild(
            nextProjectEmpty(
              '완료된 한글패치 목록을 불러오지 못했습니다.'
            )
          );

          controller.updateHeight();
        }
      }

      /*
       * V6.18.122 · NEXT 전체 진행률 즉시 복원
       * ------------------------------------------------------------
       * HOME이 이미 받아 둔 home-feed.json snapshot을 먼저 사용합니다.
       * snapshot에 분석/한글화/검수 값이 있으면 상세글 3회 fetch 없이 즉시 완성 카드.
       * direct NEXT 진입이거나 구형 feed라 값이 없을 때만 기존 상세글 fetch로 fallback.
       */
      const NEXT_FAST_FEED_URL =
        'https://calfstation.github.io/home-feed.json';
      const NEXT_FAST_FEED_CACHE_KEY =
        'calf-home-feed-v117';

      const NEXT_PROJECT_COUNT_CACHE_KEY =
        'calf-next-project-counts-v2';

      /*
       * V6.18.126 HOTFIX7
       * 현재 전체 NEXT 확정값.
       * 첫 방문/새 캐시에서도 잘못된 6/0 대신 이 값을 즉시 그립니다.
       * 이후 전체 NEXT 스캔이 끝나면 v2 캐시에 실제 최신값을 다시 저장합니다.
       */
      const NEXT_PROJECT_COUNT_SEED = {
        active: 7,
        complete: 4,
        total: 11
      };

      function readNextProjectCountCache() {
        try {
          const raw =
            localStorage.getItem(
              NEXT_PROJECT_COUNT_CACHE_KEY
            );

          if (!raw) return null;

          const saved = JSON.parse(raw);

          if (
            !saved ||
            !Number.isFinite(saved.active) ||
            !Number.isFinite(saved.complete) ||
            !Number.isFinite(saved.total)
          ) {
            return null;
          }

          return {
            active: saved.active,
            complete: saved.complete,
            total: saved.total
          };
        } catch (err) {
          return null;
        }
      }

      function writeNextProjectCountCache(
        counts
      ) {
        if (!counts) return;

        try {
          localStorage.setItem(
            NEXT_PROJECT_COUNT_CACHE_KEY,
            JSON.stringify({
              active: Number(counts.active) || 0,
              complete: Number(counts.complete) || 0,
              total:
                (Number(counts.active) || 0) +
                (Number(counts.complete) || 0)
            })
          );
        } catch (err) {}
      }

      function nextDeclaredCategoryTotal() {
        const raw =
          document.getElementById(
            'raw-category-counts'
          );

        if (!raw) return 0;

        const links =
          raw.querySelectorAll('a');

        for (const link of links) {
          const value =
            String(
              link.textContent || ''
            )
              .replace(/\s+/g, ' ')
              .trim();

          if (!value.includes('NEXT')) {
            continue;
          }

          const match =
            value.match(/\((\d+)\)/);

          if (match) {
            return Number(match[1]) || 0;
          }
        }

        return 0;
      }

      let nextFastFeedNetworkPromise = null;

      function fetchLatestNextFastFeed() {
        if (nextFastFeedNetworkPromise) {
          return nextFastFeedNetworkPromise;
        }

        const prefetched =
          window.__CALF_NEXT_FEED_PREFETCH__;

        const feedPromise =
          prefetched &&
          typeof prefetched.then === 'function'
            ? prefetched
            : fetch(NEXT_FAST_FEED_URL, {
                cache: 'no-cache',
                mode: 'cors'
              })
                .then(function (response) {
                  if (!response.ok) return null;
                  return response.json();
                })
                .catch(function () {
                  return null;
                });

        nextFastFeedNetworkPromise =
          feedPromise
            .then(function (feed) {
              if (
                feed &&
                typeof writeHomeFeedSnapshot === 'function'
              ) {
                /* HOME과 동일한 raw feed snapshot 계약을 그대로 유지합니다. */
                writeHomeFeedSnapshot(feed);
              }
              return feed && typeof feed === 'object' ? feed : null;
            })
            .catch(function () {
              return null;
            });

        return nextFastFeedNetworkPromise;
      }

      function nextActiveRecordsFromFeed(feed) {
        return (
          feed &&
          Array.isArray(feed.next)
        )
          ? feed.next
          : [];
      }

      function nextCompletedRecordsFromFeed(feed) {
        return (
          feed &&
          Array.isArray(feed.nextCompleted)
        )
          ? feed.nextCompleted
          : [];
      }

      function nextAllRecordsFromFeed(feed) {
        const active =
          nextActiveRecordsFromFeed(feed);

        const completed =
          nextCompletedRecordsFromFeed(feed);

        /*
         * 신형 feed:
         *   next = 진행 중
         *   nextCompleted = 완료
         *
         * 구형 feed에는 next 하나에 전체가 들어 있을 수 있어
         * nextCompleted가 없을 때는 next만 그대로 사용합니다.
         */
        return completed.length
          ? active.concat(completed)
          : active;
      }

      function fetchLatestNextFastFeedRecords() {
        return fetchLatestNextFastFeed()
          .then(function (feed) {
            return feed
              ? nextAllRecordsFromFeed(feed)
              : null;
          });
      }

      function readNextFastFeedSnapshotFeed() {
        try {
          const raw = localStorage.getItem(NEXT_FAST_FEED_CACHE_KEY);
          if (!raw) return null;
          const saved = JSON.parse(raw);
          const feed = saved && saved.feed;
          return feed && typeof feed === 'object' ? feed : null;
        } catch (err) {
          return null;
        }
      }

      function readNextFastFeedSnapshot() {
        const feed =
          readNextFastFeedSnapshotFeed();

        return feed
          ? nextAllRecordsFromFeed(feed)
          : null;
      }

      function nextSummaryFromFeed(feed) {
        if (!feed) return null;

        const summary = feed.nextSummary;
        if (
          summary &&
          Number.isFinite(Number(summary.active)) &&
          Number.isFinite(Number(summary.complete)) &&
          Number.isFinite(Number(summary.total))
        ) {
          return {
            active: Number(summary.active),
            complete: Number(summary.complete),
            total: Number(summary.total)
          };
        }

        const counts =
          nextFastFeedProjectCounts(
            nextAllRecordsFromFeed(feed)
          );

        if (!counts) return null;

        return {
          active: counts.active,
          complete: counts.complete,
          total: counts.active + counts.complete
        };
      }

      function isCompleteNextFeed(feed) {
        const summary =
          nextSummaryFromFeed(feed);

        if (
          !summary ||
          summary.total <= 0
        ) {
          return false;
        }

        const active =
          nextActiveRecordsFromFeed(feed);

        const completed =
          nextCompletedRecordsFromFeed(feed);

        if (Array.isArray(feed.nextCompleted)) {
          return (
            active.length ===
              summary.active &&
            completed.length ===
              summary.complete &&
            active.length +
              completed.length ===
              summary.total
          );
        }

        /* 구형 feed 호환 */
        return (
          active.length ===
          summary.total
        );
      }

      function nextFastRecordMap(records) {
        const map = new Map();
        (records || []).forEach(function (record) {
          const path = String(record && (record.path || record.url) || '')
            .replace(/\/+$/, '') || '/';
          if (path) map.set(path, record);
        });
        return map;
      }

      function nextItemSourcePath(item) {
        const link = item && item.querySelector('a');
        const raw = link
          ? (link.dataset.originalHref || link.dataset.nextOriginalHref || link.getAttribute('href') || '')
          : '';
        try {
          return (new URL(raw, location.href).pathname.replace(/\/+$/, '') || '/');
        } catch (err) {
          return '';
        }
      }

      function applyNextFastRecord(item, record) {
        if (!item || !record) return false;
        const keys = ['analysis', 'translation', 'review'];
        if (!keys.every(function (key) { return Number.isFinite(Number(record[key])); })) {
          return false;
        }

        const sourceLink = item.querySelector('a');
        if (sourceLink) {
          const sourcePath = String(record.path || record.url || '');
          if (sourcePath) {
            sourceLink.dataset.nextOriginalHref = sourcePath;
          }
          if (record.image) {
            sourceLink.dataset.nextOriginalImage = String(record.image);
          }
          if (record.title) {
            sourceLink.dataset.nextOriginalTitle = String(record.title);
          }
          if (record.date) {
            sourceLink.dataset.nextOriginalDate = String(record.date);
          }
        }

        const block = document.createElement('div');
        block.className = 'calf-next-project';
        block.dataset.projectTitle = String(record.title || '');
        block.dataset.analysis = String(record.analysis);
        block.dataset.translation = String(record.translation);
        block.dataset.review = String(record.review);
        if (record.platform) block.dataset.platform = String(record.platform);
        if (record.test) block.dataset.test = String(record.test);

        return renderNextProjectCard(item, document, block);
      }

      function createNextItemFromFastRecord(record) {
        if (!record) return null;

        const item = document.createElement('li');
        item.className = 'post-item';

        const link = document.createElement('a');
        const sourcePath = String(record.path || record.url || '#');
        link.setAttribute('href', sourcePath);
        link.dataset.nextOriginalHref = sourcePath;
        link.dataset.nextOriginalTitle = String(record.title || '한글화 프로젝트');
        link.dataset.nextOriginalDate = String(record.date || '');
        if (record.image) {
          link.dataset.nextOriginalImage = String(record.image);
        }

        link.innerHTML = `
          <span class="post-text">
            <strong>${esc(record.title || '한글화 프로젝트')}</strong>
            <em>${esc(record.date || '')}</em>
          </span>`;

        item.appendChild(link);

        return applyNextFastRecord(item, record)
          ? item
          : null;
      }

      function materializeNextItemsFromFeed(records, reusableItems) {
        const reusable = new Map();

        (reusableItems || []).forEach(function (item) {
          const key = nextItemSourcePath(item);
          if (key) reusable.set(key, item);
        });

        return (records || [])
          .map(function (record) {
            const key = String(record && (record.path || record.url) || '')
              .replace(/\/+$/, '') || '/';

            const item = reusable.get(key) || createNextItemFromFastRecord(record);
            if (!item) return null;

            applyNextFastRecord(item, record);
            return item;
          })
          .filter(Boolean);
      }

      async function hydrateNextFromFastFeed(items) {
        const resolved = new Array(items.length).fill(false);
        let records = readNextFastFeedSnapshot();
        let map = nextFastRecordMap(records || []);

        /*
         * V6.18.122
         * 오래된 HOME snapshot(예: NEXT 3개만 저장된 V121 이전 캐시)이 있어도
         * 그 3개는 즉시 적용하고, 누락된 카드가 하나라도 있으면 작은 GitHub JSON을
         * 한 번 갱신해서 나머지도 상세글 fetch 없이 채웁니다.
         */
        items.forEach(function (item, index) {
          const record = map.get(nextItemSourcePath(item));
          if (record) {
            resolved[index] = applyNextFastRecord(item, record);
          }
        });

        if (resolved.every(Boolean)) {
          return resolved;
        }

        records =
          await fetchLatestNextFastFeedRecords();

        map = nextFastRecordMap(records || []);

        items.forEach(function (item, index) {
          if (resolved[index]) return;
          const record = map.get(nextItemSourcePath(item));
          if (record) {
            resolved[index] =
              applyNextFastRecord(
                item,
                record
              );
          }
        });

        return resolved;
      }


      function finishNextDashboardBoot() {
        document.documentElement.classList.remove(
          'calf-next-booting'
        );
      }

      /*
       * V6.18.126 HOTFIX · NEXT 이전 진행률 카드 보존
       * ------------------------------------------------------------
       * 현재 화면의 1페이지 카드는 기존 즉시 렌더 경로를 그대로 사용합니다.
       * 그 뒤 /category/NEXT?page=2... 만 추가로 읽어 예전 진행률 글을
       * 동일한 카드/스와이프 UI에 이어 붙입니다.
       *
       * CSS, 카드 크기, 간격, 진행률 렌더러는 변경하지 않습니다.
       */
      async function collectOlderNextProjectItems(
        currentItems
      ) {
        const collected = [];
        const seen = new Set(
          (currentItems || [])
            .map(nextItemSourcePath)
            .filter(Boolean)
        );

        for (
          let page = 2;
          page <= NEXT_COMPLETED_MAX_SOURCE_PAGES;
          page += 1
        ) {
          const url = new URL(
            NEXT_PROGRESS_CATEGORY_URL,
            location.origin
          );

          url.searchParams.set(
            'page',
            String(page)
          );

          let response = null;

          try {
            response = await fetch(url.href, {
              credentials: 'same-origin',
              cache: 'default'
            });
          } catch (err) {
            break;
          }

          if (!response.ok) break;

          const doc =
            new DOMParser().parseFromString(
              await response.text(),
              'text/html'
            );

          const pageItems = Array.from(
            doc.querySelectorAll(
              '.list-card .post-list > .post-item'
            )
          ).slice(0, 30);

          if (!pageItems.length) break;

          let added = 0;

          pageItems.forEach(function (sourceItem) {
            const key =
              nextItemSourcePath(sourceItem);

            if (!key || seen.has(key)) return;

            seen.add(key);

            collected.push(
              document.importNode(
                sourceItem,
                true
              )
            );

            added += 1;
          });

          /*
           * 티스토리가 마지막 페이지 이후에도 같은 목록을 반복하면
           * 신규 URL이 0개이므로 여기서 종료합니다.
           */
          if (!added) break;
        }

        return collected;
      }

      async function hydrateOlderNextProjectItems(
        olderItems
      ) {
        if (!olderItems.length) return;

        const fastResults =
          await hydrateNextFromFastFeed(
            olderItems
          );

        const fallbackIndexes = [];

        fastResults.forEach(
          function (ok, index) {
            if (!ok) {
              fallbackIndexes.push(index);
            }
          }
        );

        if (!fallbackIndexes.length) return;

        await Promise.all(
          fallbackIndexes.map(function (index) {
            return loadNextProjectItem(
              olderItems[index]
            );
          })
        );
      }

      function nextFastFeedProjectCounts(
        records
      ) {
        if (!Array.isArray(records)) {
          return null;
        }

        const unique = new Map();

        records.forEach(function (record) {
          const key = String(
            record &&
            (record.path || record.url) ||
            ''
          )
            .replace(/\/+$/, '') ||
            '';

          if (!key || unique.has(key)) return;
          unique.set(key, record);
        });

        if (!unique.size) return null;

        let complete = 0;

        unique.forEach(function (record) {
          if (
            normalizeNextTestState(
              record && record.test
            ) === 'complete'
          ) {
            complete += 1;
          }
        });

        return {
          active:
            Math.max(
              0,
              unique.size - complete
            ),
          complete: complete
        };
      }

      function setNextProjectHeaderCounts(
        card,
        counts
      ) {
        if (!card || !counts) return;

        const activeCount =
          card.querySelector(
            '[data-next-active-count]'
          );

        const completeCount =
          card.querySelector(
            '[data-next-complete-count]'
          );

        if (activeCount) {
          activeCount.textContent =
            String(counts.active);
        }

        if (completeCount) {
          completeCount.textContent =
            String(counts.complete);
        }

        writeNextProjectCountCache(
          counts
        );
      }

      function applyNextProjectView(
        card,
        controller,
        items,
        view
      ) {
        if (
          !controller ||
          !controller.visibleProjectItems
        ) {
          return;
        }

        const nextView =
          view === 'complete'
            ? 'complete'
            : 'active';

        const filtered =
          (items || []).filter(function (item) {
            if (
              !item ||
              !item.dataset ||
              item.dataset.nextEntryType !==
                'project'
            ) {
              return false;
            }

            const isComplete =
              item.dataset.nextTestState ===
              'complete';

            return nextView === 'complete'
              ? isComplete
              : !isComplete;
          });

        controller.visibleProjectItems.splice(
          0,
          controller.visibleProjectItems.length
        );

        filtered.forEach(function (item) {
          controller.visibleProjectItems.push(
            item
          );
        });

        controller.nextProjectView = nextView;

        if (controller.projectPager) {
          controller.projectPager.rebuild();
          controller.projectPager.goToPage(
            0,
            false
          );
        }

        card
          .querySelectorAll(
            '[data-next-view-target]'
          )
          .forEach(function (node) {
            const selected =
              node.dataset.nextViewTarget ===
              nextView;

            node.setAttribute(
              'aria-pressed',
              selected
                ? 'true'
                : 'false'
            );
          });
      }

      function installNextProjectViewSwitch(
        card,
        controller,
        items
      ) {
        if (!card || !controller) return;

        card
          .querySelectorAll(
            '[data-next-view-target]'
          )
          .forEach(function (node) {
            node.style.cursor = 'pointer';

            if (
              node.dataset.nextViewBound ===
              '1'
            ) {
              return;
            }

            node.dataset.nextViewBound = '1';

            function activate() {
              applyNextProjectView(
                card,
                controller,
                items,
                node.dataset.nextViewTarget
              );
            }

            node.addEventListener(
              'click',
              activate
            );

            node.addEventListener(
              'keydown',
              function (event) {
                if (
                  event.key !== 'Enter' &&
                  event.key !== ' '
                ) {
                  return;
                }

                event.preventDefault();
                activate();
              }
            );
          });
      }

      function updateNextProjectHeaderCounts(
        card,
        items
      ) {
        if (!card) return;

        const projects = (items || []).filter(function (item) {
          return (
            item &&
            item.dataset &&
            item.dataset.nextEntryType === 'project'
          );
        });

        const completed = projects.filter(function (item) {
          return item.dataset.nextTestState === 'complete';
        }).length;

        const active =
          Math.max(0, projects.length - completed);

        setNextProjectHeaderCounts(
          card,
          {
            active: active,
            complete: completed
          }
        );
      }

      async function initNextProgressDashboard() {
        if (!isNextCategoryPage()) return;

        if (
          document.querySelector(
            '.list-card[data-next-full-init="1"]'
          )
        ) {
          return;
        }

        const list = document.querySelector(
          '.list-card .post-list'
        );

        if (!list) {
          finishNextDashboardBoot();
          return;
        }

        const card = list.closest('.list-card');
        if (!card) {
          finishNextDashboardBoot();
          return;
        }

        card.dataset.nextFullInit = '1';
        card.classList.add('calf-next-dashboard');

        const articleLabel = card.querySelector(':scope > .label');
        if (articleLabel) articleLabel.remove();

        const nativeItems = Array.from(
          list.querySelectorAll(':scope > .post-item')
        ).slice(0, 30);

        nativeItems.forEach(renderNextProjectPlaceholder);

        /*
         * FAST PATH 핵심:
         * - localStorage에 전체 feed가 있으면 네트워크 0회로 전체 NEXT 즉시 렌더
         * - 없으면 현재 1페이지 골격을 먼저 보여주고 작은 JSON 1회만 기다림
         * - /category/NEXT?page=2... 또는 개별 게시글 fetch는 방문자 브라우저에서 금지
         */
        const snapshotFeed = readNextFastFeedSnapshotFeed();
        const snapshotFull = isCompleteNextFeed(snapshotFeed);

        let items = snapshotFull
          ? materializeNextItemsFromFeed(
              nextAllRecordsFromFeed(
                snapshotFeed
              ),
              nativeItems
            )
          : nativeItems;

        if (!snapshotFull) {
          const snapshotMap = nextFastRecordMap(
            snapshotFeed
              ? nextAllRecordsFromFeed(
                  snapshotFeed
                )
              : []
          );

          items.forEach(function (item) {
            const record = snapshotMap.get(nextItemSourcePath(item));
            if (record) applyNextFastRecord(item, record);
          });
        }

        const cachedCounts = readNextProjectCountCache();
        const snapshotSummary = isCompleteNextFeed(snapshotFeed)
          ? nextSummaryFromFeed(snapshotFeed)
          : null;

        const initialCounts = snapshotSummary
          ? {
              active: snapshotSummary.active,
              complete: snapshotSummary.complete
            }
          : cachedCounts
            ? {
                active: cachedCounts.active,
                complete: cachedCounts.complete
              }
            : {
                active: NEXT_PROJECT_COUNT_SEED.active,
                complete: NEXT_PROJECT_COUNT_SEED.complete
              };

        const controller = createNextDashboard(
          card,
          list,
          items,
          initialCounts
        );

        installNextProjectViewSwitch(card, controller, items);
        controller.nextProjectView = 'active';
        applyNextProjectView(card, controller, items, 'active');
        finishNextDashboardBoot();

        /*
         * 최신 feed는 한 번만 확인합니다. 전체 레코드가 도착하면 현재 DOM을
         * 그 레코드들로 교체하고 같은 pager를 rebuild합니다.
         */
        fetchLatestNextFastFeed()
          .then(function (feed) {
            if (!isCompleteNextFeed(feed)) return;

            const freshItems =
              materializeNextItemsFromFeed(
                nextAllRecordsFromFeed(
                  feed
                ),
                items.concat(nativeItems)
              );

            items.splice(0, items.length);
            freshItems.forEach(function (item) {
              items.push(item);
            });

            const summary = nextSummaryFromFeed(feed);
            if (summary) {
              setNextProjectHeaderCounts(card, summary);
            } else {
              updateNextProjectHeaderCounts(card, items);
            }

            applyNextProjectView(
              card,
              controller,
              items,
              controller.nextProjectView
            );
          })
          .catch(function () {
            /* 실패 시 이미 보이는 snapshot/현재 1페이지 카드를 그대로 유지합니다. */
          });
      }

      function patchPlatformCodeFromDocument(doc, post) {
        const block = doc && doc.querySelector
          ? doc.querySelector('.calf-patch-auto')
          : null;

        const fromBlock = block
          ? normalizeCalfPlatformCode(
              block.dataset.platformCode ||
              block.dataset.platform ||
              ''
            )
          : '';

        if (fromBlock) return fromBlock;

        const titleCode = normalizeCalfPlatformCode(
          post && post.title ? post.title : ''
        );

        if (titleCode) return titleCode;

        const article = doc && doc.querySelector
          ? doc.querySelector(
              '#article-view, .tt_article_useless_p_margin, .entry-content, .article-view'
            )
          : null;

        const bodyCode = normalizeCalfPlatformCode(
          article ? article.textContent.slice(0, 4000) : ''
        );

        if (bodyCode) return bodyCode;

        /*
         * V6.18.33 적용 시점의 기존 한글 패치 아카이브는 FC 작품들입니다.
         * 예전 글에 플랫폼 메타데이터가 전혀 없는 경우만 레거시 FC로 보정합니다.
         */
        return 'fc';
      }

      async function hydratePatchArchivePlatforms(posts) {
        return Promise.all(
          posts.map(async function (post) {
            try {
              const response = await fetch(
                post.url,
                {
                  credentials: 'same-origin',
                  cache: 'default'
                }
              );

              if (!response.ok) {
                throw new Error('HTTP ' + response.status);
              }

              const doc = new DOMParser().parseFromString(
                await response.text(),
                'text/html'
              );

              return Object.assign(
                {},
                post,
                {
                  platformCode:
                    patchPlatformCodeFromDocument(doc, post)
                }
              );
            } catch (err) {
              return Object.assign(
                {},
                post,
                {
                  platformCode:
                    normalizeCalfPlatformCode(post.title) || 'fc'
                }
              );
            }
          })
        );
      }

      function patchPlatformOrder(code) {
        const order = [
          'fc','sfc','md','sms','pce',
          'gb','gbc','gba','nds','ps1','other'
        ];
        const index = order.indexOf(code);
        return index === -1 ? order.length : index;
      }

      /*
       * V6.18.33 · 한글 패치 아카이브용 연속 가로 레일
       * - 페이지/화살표/도트 없음
       * - 마우스 드래그 + 터치 스와이프
       * - 카드 한 장 단위 scroll-snap
       * - 빠르게 밀면 이동량을 반영해 가까운 카드에 부드럽게 안착
       */
      /*
       * V6.18.36 · 한글 패치 아카이브 무한 스냅 레일
       * - 자유 관성 제거: 손을 놓으면 가까운 카드 위치로 짧고 부드럽게 안착
       * - 3중 복제 + 보이지 않는 위치 정규화로 마지막 다음에 첫 카드가 즉시 이어짐
       * - 클릭과 드래그는 7px 임계값으로 분리
       * - PC/태블릿/모바일 모두 다음 카드가 오른쪽에 살짝 보이도록 설계
       */
      function createCalfArchiveRail(
        host,
        entries,
        renderEntry,
        options
      ) {
        const config = options || {};

        host.innerHTML = '';

        const viewport = document.createElement('div');
        viewport.className = 'calf-archive-rail';
        viewport.setAttribute(
          'aria-label',
          config.ariaLabel || '한글 패치 목록'
        );
        viewport.setAttribute('tabindex', '0');

        const track = document.createElement('div');
        track.className = 'calf-archive-rail-track';

        const sourceEntries = Array.isArray(entries)
          ? entries.filter(Boolean)
          : [];
        const infinite = sourceEntries.length > 1;
        const copyCount = infinite ? 3 : 1;

        for (let copy = 0; copy < copyCount; copy += 1) {
          sourceEntries.forEach(function (entry, index) {
            const rendered = renderEntry(entry, index);
            if (!rendered) return;

            const cell = document.createElement('div');
            cell.className = 'calf-archive-rail-item';
            cell.dataset.logicalIndex = String(index);
            cell.dataset.railCopy = String(copy);

            if (infinite && copy !== 1) {
              cell.setAttribute('aria-hidden', 'true');
              rendered.querySelectorAll('a,button,input,select,textarea,[tabindex]')
                .forEach(function (node) {
                  node.setAttribute('tabindex', '-1');
                });
            }

            cell.appendChild(rendered);
            track.appendChild(cell);
          });
        }

        viewport.appendChild(track);
        host.appendChild(viewport);

        let pointerId = null;
        let pointerActive = false;
        let dragging = false;
        let moved = false;
        let startX = 0;
        let dragX = 0;
        let lastX = 0;
        let lastTime = 0;
        let velocity = 0;
        let currentIndex = infinite ? sourceEntries.length : 0;
        let suppressClick = false;
        let snapTimer = 0;
        let wheelAccum = 0;
        let wheelTimer = 0;
        let resizeTimer = 0;

        function railStride() {
          const first = track.querySelector('.calf-archive-rail-item');
          if (!first) return Math.max(1, viewport.clientWidth);

          const styles = getComputedStyle(track);
          const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
          return Math.max(1, first.getBoundingClientRect().width + gap);
        }

        function xForIndex(index) {
          return -(index * railStride());
        }

        function setTransition(enabled) {
          track.style.transition = enabled
            ? 'transform 420ms cubic-bezier(.22,1,.36,1)'
            : 'none';
        }

        function renderAt(index, extraX) {
          const x = xForIndex(index) + (extraX || 0);
          track.style.transform = 'translate3d(' + x + 'px,0,0)';
        }

        function normalizeIndex() {
          if (!infinite) return;
          const n = sourceEntries.length;
          let next = currentIndex;

          while (next < n) next += n;
          while (next >= n * 2) next -= n;

          if (next !== currentIndex) {
            currentIndex = next;
            setTransition(false);
            renderAt(currentIndex, 0);
            /* transition:none이 확실히 반영된 뒤 다음 동작에서 다시 켭니다. */
            void track.offsetWidth;
          }
        }

        function settleTo(index, duration) {
          if (!sourceEntries.length) return;

          clearTimeout(snapTimer);
          currentIndex = Math.round(index);

          if (!infinite) {
            currentIndex = Math.max(0, Math.min(sourceEntries.length - 1, currentIndex));
          }

          track.style.transition = 'transform ' +
            Math.max(260, Math.min(480, duration || 410)) +
            'ms cubic-bezier(.22,1,.36,1)';
          renderAt(currentIndex, 0);

          snapTimer = window.setTimeout(function () {
            snapTimer = 0;
            normalizeIndex();
          }, Math.max(300, Math.min(520, (duration || 410) + 35)));
        }

        function placeInitial() {
          setTransition(false);
          renderAt(currentIndex, 0);
          requestAnimationFrame(function () {
            void track.offsetWidth;
          });
        }

        requestAnimationFrame(placeInitial);

        viewport.addEventListener('pointerdown', function (event) {
          if (!event.isPrimary || event.button !== 0) return;

          clearTimeout(snapTimer);
          snapTimer = 0;
          normalizeIndex();
          setTransition(false);

          pointerId = event.pointerId;
          pointerActive = true;
          dragging = false;
          moved = false;
          startX = event.clientX;
          dragX = 0;
          lastX = event.clientX;
          lastTime = performance.now();
          velocity = 0;
        });

        viewport.addEventListener('pointermove', function (event) {
          if (!pointerActive || event.pointerId !== pointerId) return;

          const dx = event.clientX - startX;

          if (!dragging) {
            if (Math.abs(dx) < 7) return;
            dragging = true;
            moved = true;
            viewport.classList.add('is-dragging');

            try {
              viewport.setPointerCapture(pointerId);
            } catch (err) {}
          }

          event.preventDefault();
          dragX = dx;
          renderAt(currentIndex, dragX);

          const now = performance.now();
          const dt = Math.max(1, now - lastTime);
          velocity = (event.clientX - lastX) / dt;
          lastX = event.clientX;
          lastTime = now;
        }, { passive:false });

        function finishDrag(event) {
          if (!pointerActive || (event && event.pointerId !== pointerId)) return;

          pointerActive = false;
          viewport.classList.remove('is-dragging');

          try {
            if (
              pointerId !== null &&
              viewport.hasPointerCapture &&
              viewport.hasPointerCapture(pointerId)
            ) {
              viewport.releasePointerCapture(pointerId);
            }
          } catch (err) {}

          pointerId = null;

          if (!dragging) {
            dragging = false;
            return;
          }

          dragging = false;

          const stride = railStride();
          /*
           * 드래그 거리 + 마지막 손속도를 짧게 투영합니다.
           * 자유 관성은 없고, 결과는 반드시 카드 위치에 착 붙습니다.
           * 보통 한 장, 강한 플릭/긴 드래그는 최대 두 장까지 이동합니다.
           */
          const projectedX = dragX + velocity * 105;
          let shift = -Math.round(projectedX / Math.max(1, stride));

          if (shift === 0 && Math.abs(dragX) > stride * .16) {
            shift = dragX < 0 ? 1 : -1;
          }
          if (shift === 0 && Math.abs(velocity) > .42) {
            shift = velocity < 0 ? 1 : -1;
          }

          shift = Math.max(-2, Math.min(2, shift));

          suppressClick = true;
          window.setTimeout(function () {
            suppressClick = false;
          }, 170);

          settleTo(currentIndex + shift, Math.abs(shift) > 1 ? 460 : 390);
        }

        viewport.addEventListener('pointerup', finishDrag);
        viewport.addEventListener('pointercancel', finishDrag);

        viewport.addEventListener(
          'click',
          function (event) {
            if (!suppressClick) return;
            event.preventDefault();
            event.stopPropagation();
          },
          true
        );

        viewport.addEventListener('dragstart', function (event) {
          event.preventDefault();
        });

        /* 트랙패드의 수평 제스처도 짧은 스냅으로 통일 */
        viewport.addEventListener('wheel', function (event) {
          const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
          const delta = horizontal
            ? event.deltaX
            : (event.shiftKey ? event.deltaY : 0);

          if (!delta) return;
          event.preventDefault();

          normalizeIndex();
          wheelAccum += delta;
          const stride = railStride();
          const preview = Math.max(-stride * .72, Math.min(stride * .72, -wheelAccum));
          setTransition(false);
          renderAt(currentIndex, preview);

          clearTimeout(wheelTimer);
          wheelTimer = window.setTimeout(function () {
            const move = Math.abs(wheelAccum) > stride * .12
              ? (wheelAccum > 0 ? 1 : -1)
              : 0;
            wheelAccum = 0;
            settleTo(currentIndex + move, 360);
          }, 95);
        }, { passive:false });

        viewport.addEventListener('keydown', function (event) {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          normalizeIndex();
          settleTo(
            currentIndex + (event.key === 'ArrowRight' ? 1 : -1),
            360
          );
        });

        window.addEventListener('resize', function () {
          clearTimeout(resizeTimer);
          resizeTimer = window.setTimeout(function () {
            normalizeIndex();
            setTransition(false);
            renderAt(currentIndex, 0);
          }, 90);
        });

        return viewport;
      }

      function patchPlatformSection(code, posts) {
        const meta = calfPlatformMeta(code);
        const section = document.createElement('section');
        section.className = 'calf-patch-platform-section';
        section.dataset.platform = meta.code;

        const header = document.createElement('header');
        header.className = 'calf-patch-platform-header';

        const title = document.createElement('h3');
        title.className = 'calf-patch-platform-title';
        title.textContent = meta.label;
        header.appendChild(title);

        const wordmark = calfPlatformAsset(meta.code, 'wordmark');

        if (wordmark) {
          const markWrap = document.createElement('span');
          markWrap.className = 'calf-patch-platform-wordmark-wrap';

          const image = document.createElement('img');
          image.className = 'calf-patch-platform-wordmark';
          image.src = wordmark;
          image.alt = meta.label + ' 로고';
          image.loading = 'lazy';
          image.addEventListener('error', function () {
            markWrap.classList.add('is-image-missing');
            image.remove();
          });

          const fallback = document.createElement('span');
          fallback.className = 'calf-patch-platform-wordmark-fallback';
          fallback.textContent = meta.short;

          markWrap.appendChild(image);
          markWrap.appendChild(fallback);
          header.appendChild(markWrap);
        }

        const pagerHost = document.createElement('div');
        pagerHost.className = 'calf-patch-platform-pager-host';

        section.appendChild(header);
        section.appendChild(pagerHost);

        /*
         * V6.18.40: NEXT 메뉴의 '배포 완료 한글패치'와 코드/옵션까지 동일화.
         * centerShortPage 차이를 제거해 PC에서도 같은 이동 리듬을 사용합니다.
         * 화살표·도트·다음 페이지 PEEK를 함께 유지합니다.
         */
        createNextSwipePager(
          pagerHost,
          posts,
          function (post) {
            return nextNodeFromHtml(
              nextCompletedCard(post)
            );
          },
          {
            gridClass: 'calf-next-completed-page-grid',
            ariaLabel: meta.label + ' 한글 패치 페이지',
            pageSizeResolver: nextArchiveCardsPerPage,
            peek: true,
            prewarmMedia: true
          }
        );

        return section;
      }

      /* =========================================================
         V6.18.76 · 한글패치 아카이브 즉시 렌더
         ---------------------------------------------------------
         현재 카테고리 페이지의 HTML에는 이미 제목/날짜/대표이미지가 들어 있습니다.
         그것을 먼저 즉시 카드로 그린 뒤, 플랫폼 메타데이터/추가 페이지는 뒤에서
         보강합니다. 네트워크가 느려도 첫 화면이 빈 채로 기다리지 않습니다.
         ========================================================= */
      function renderPatchArchiveGroups(host, compactHeader, posts) {
        host.innerHTML = '';

        const count = compactHeader.querySelector(
          '[data-patch-archive-count]'
        );
        if (count) count.textContent = String(posts.length);

        if (!posts.length) {
          host.appendChild(
            nextProjectEmpty('아직 배포된 한글패치가 없습니다.')
          );
          return;
        }

        const groups = new Map();
        posts.forEach(function (post) {
          const code = post.platformCode || 'other';
          if (!groups.has(code)) groups.set(code, []);
          groups.get(code).push(post);
        });

        Array.from(groups.entries())
          .sort(function (a, b) {
            return patchPlatformOrder(a[0]) - patchPlatformOrder(b[0]);
          })
          .forEach(function (entry) {
            host.appendChild(
              patchPlatformSection(entry[0], entry[1])
            );
          });
      }

      async function initPatchArchiveCategoryPage() {
        if (!isPatchCategoryPage()) return;

        /* V6.18.78: body 끝 script에서 DOMContentLoaded보다 먼저 1회 선실행합니다.
           이후 startCalfSkin()이 다시 호출해도 중복 렌더하지 않습니다. */
        if (document.documentElement.dataset.calfPatchArchiveMounted === '1') {
          return;
        }
        document.documentElement.dataset.calfPatchArchiveMounted = '1';

        const card = document.querySelector(
          '.list-card'
        );

        const list = card
          ? card.querySelector('.post-list')
          : null;

        if (!card || !list) {
          delete document.documentElement.dataset.calfPatchArchiveMounted;
          return;
        }

        card.classList.add(
          'calf-patch-archive-page'
        );

        const label =
          card.querySelector('.label');

        if (label) {
          label.textContent =
            'PATCH ARCHIVE';
        }

        const title =
          card.querySelector('.page-title');

        /*
         * 한글화 컴팩트 헤더
         * PATCH ARCHIVE / 한글화 / 작품 수 / 설명을 한 줄에 합칩니다.
         * 플랫폼 카드가 한 화면에 더 많이 보이는 것이 목적입니다.
         */
        const compactHeader =
          document.createElement('header');

        compactHeader.className =
          'calf-compact-section-head calf-patch-compact-head';

        compactHeader.innerHTML = `
          <span class="label calf-compact-section-kicker">
            PATCH ARCHIVE
          </span>
          <h2 class="page-title calf-compact-section-title">
            ${esc(
              window.CALF_PATCH_CATEGORY.displayName
            )}
          </h2>
          <span
            class="calf-next-panel-count"
            data-patch-archive-count>
            0
          </span>
          <span class="calf-compact-section-separator" aria-hidden="true"></span>
          <p class="calf-compact-section-desc">
            배포가 완료된 한글 패치를 기종별 대표 이미지 카드로 모았습니다.
          </p>`;

        /* 기존 라벨/제목은 새 헤더와 중복되므로 DOM에서 제거합니다. */
        if (label) label.remove();
        if (title) title.remove();

        card.insertBefore(
          compactHeader,
          card.firstChild
        );

        /*
         * V6.18.78 · 중요: 원본 리스트를 없애기 전에 먼저 읽습니다.
         * V6.18.76/77은 list.replaceWith(host) 뒤에 document를 파싱해서
         * instantPosts가 항상 0개가 되는 회귀가 있었습니다. 그 결과
         * '아직 배포된 한글패치가 없습니다.'가 먼저 뜬 뒤 약 1초 후 카드가
         * 다시 나타났습니다. 여기서는 티스토리가 이미 내려준 HTML을 먼저
         * 즉시 읽고, 그 다음에 레이아웃만 교체합니다.
         */
        const instantPosts = parseNextCompletedItems(document)
          .map(function (post) {
            return Object.assign({}, post, {
              platformCode:
                normalizeCalfPlatformCode(post.title) || 'fc'
            });
          });

        const host =
          document.createElement('div');

        host.className =
          'calf-patch-category-archive-host';

        list.replaceWith(host);

        const paging =
          document.getElementById('paging');

        if (paging) {
          paging.style.display = 'none';
        }

        renderPatchArchiveGroups(
          host,
          compactHeader,
          instantPosts
        );

        /* 네트워크 요청보다 먼저 첫 화면을 공개합니다. */
        document.documentElement.classList.remove(
          'calf-patch-booting'
        );

        /*
         * 플랫폼 정밀 분류/추가 페이지는 첫 페인트 뒤 백그라운드 처리.
         * 결과가 현재 화면과 완전히 같으면 DOM을 다시 만들지 않습니다.
         * 따라서 같은 4개 FC 카드가 '팟' 하고 한 번 더 깜빡이는 현상도 막습니다.
         */
        window.setTimeout(async function () {
          try {
            const rawPosts =
              await collectNextCompletedItems();

            const posts =
              await hydratePatchArchivePlatforms(
                rawPosts
              );

            const signature = function (items) {
              return items.map(function (post) {
                return [
                  post.url || '',
                  post.platformCode || 'other',
                  post.title || ''
                ].join('::');
              }).join('||');
            };

            if (signature(posts) !== signature(instantPosts)) {
              renderPatchArchiveGroups(
                host,
                compactHeader,
                posts
              );
            }
          } catch (err) {
            console.warn(
              '[CALF PATCH] 아카이브 백그라운드 보강 실패',
              err
            );

            /* 즉시 렌더된 카드가 있으면 절대 지우지 않습니다. */
            if (!host.children.length) {
              host.appendChild(
                nextProjectEmpty(
                  '한글패치 아카이브를 불러오지 못했습니다.'
                )
              );
            }
          }
        }, 0);
      }

      const NEXT_FEED_CACHE_KEY =
        'calf-next-feed-hidden-urls-v1';

      const NEXT_FEED_CACHE_TTL =
        10 * 60 * 1000;

      function readNextFeedCache() {
        try {
          const raw =
            sessionStorage.getItem(
              NEXT_FEED_CACHE_KEY
            );

          if (!raw) return null;

          const parsed = JSON.parse(raw);

          if (
            !parsed ||
            !Array.isArray(parsed.urls) ||
            !Number.isFinite(parsed.savedAt)
          ) {
            return null;
          }

          if (
            Date.now() - parsed.savedAt >
            NEXT_FEED_CACHE_TTL
          ) {
            sessionStorage.removeItem(
              NEXT_FEED_CACHE_KEY
            );

            return null;
          }

          return new Set(parsed.urls);
        } catch (err) {
          return null;
        }
      }

      function writeNextFeedCache(urlSet) {
        try {
          sessionStorage.setItem(
            NEXT_FEED_CACHE_KEY,
            JSON.stringify({
              savedAt: Date.now(),
              urls: Array.from(urlSet)
            })
          );
        } catch (err) {}
      }

      function normalizedLocalEntryUrl(value) {
        const normalized =
          normalizeNextCompletedUrl(value);

        if (!normalized) return '';

        try {
          const url = new URL(normalized);

          url.hash = '';
          url.search = '';

          return url.href.replace(/\/+$/, '');
        } catch (err) {
          return '';
        }
      }

      function filterNextPostsFromVisibleLists(
        nextUrlSet
      ) {
        if (
          !nextUrlSet ||
          !nextUrlSet.size
        ) {
          return;
        }

        /*
         * NEXT 카테고리 페이지에서는
         * 본문의 진행률 원본 목록을 건드리지 않습니다.
         * 대신 아래 최근 게시물 영역은 모든 페이지에서
         * 동일하게 NEXT 글을 제거합니다.
         */
        if (!isNextCategoryPage()) {
          const listItems = Array.from(
            document.querySelectorAll(
              '.list-card .post-list > .post-item'
            )
          );

          listItems.forEach(function (item) {
            /*
             * NEXT 대시보드가 이미 만든 프로젝트 카드는
             * 이 필터의 대상이 아닙니다.
             */
            if (
              item.classList.contains(
                'calf-next-project-item'
              )
            ) {
              return;
            }

            const link =
              item.querySelector('a[href]');

            if (!link) return;

            const url =
              normalizedLocalEntryUrl(
                link.getAttribute('href') ||
                link.href
              );

            if (
              url &&
              nextUrlSet.has(url)
            ) {
              item.remove();
            }
          });
        }

        const recentItems = Array.from(
          document.querySelectorAll(
            '.recent-grid > li'
          )
        );

        recentItems.forEach(function (item) {
          const link =
            item.querySelector('a[href]');

          if (!link) return;

          const url =
            normalizedLocalEntryUrl(
              link.getAttribute('href') ||
              link.href
            );

          if (
            url &&
            nextUrlSet.has(url)
          ) {
            item.remove();
          }
        });

        document
          .querySelectorAll('.recent-box')
          .forEach(function (box) {
            const remaining =
              box.querySelectorAll(
                '.recent-grid > li'
              ).length;

            box.hidden = remaining === 0;
          });

        if (!isNextCategoryPage()) {
          document
            .querySelectorAll(
              '.list-card .post-list'
            )
            .forEach(function (list) {
              const remaining =
                list.querySelectorAll(
                  ':scope > .post-item'
                ).length;

              list.classList.toggle(
                'is-calf-filtered-empty',
                remaining === 0
              );
            });
        }
      }

      async function collectNextProgressUrls() {
        const posts =
          await collectCategoryItems(
            NEXT_PROGRESS_CATEGORY_URL,
            'NEXT'
          );

        return new Set(
          posts
            .map(function (post) {
              return normalizedLocalEntryUrl(
                post.url
              );
            })
            .filter(Boolean)
        );
      }

      async function initHideNextPostsFromFeeds() {
        /*
         * 모든 페이지의 최근 게시물에서는
         * NEXT 진행률 글을 제외합니다.
         *
         * NEXT 페이지에서는 filter 함수가
         * 본문 진행률 목록만 자동으로 보호합니다.
         */
        const cached =
          readNextFeedCache();

        if (cached && cached.size) {
          filterNextPostsFromVisibleLists(
            cached
          );
        }

        try {
          const freshUrls =
            await collectNextProgressUrls();

          writeNextFeedCache(freshUrls);

          filterNextPostsFromVisibleLists(
            freshUrls
          );
        } catch (err) {
          console.warn(
            '[CALF FEED] NEXT 글 제외 처리 실패',
            err
          );
        }
      }

      const HOME_ARTICLES_PER_PAGE = 6;
      const HOME_MAX_SOURCE_PAGES = 30;

      function homeArticlesPerPage() {
        return HOME_ARTICLES_PER_PAGE;
      }

      function finishHomeArticleBoot() {
        document.documentElement.classList.remove(
          'calf-home-booting'
        );
      }

      async function collectHomePostItems(
        nextUrlSet
      ) {
        const collected = [];
        const seen = new Set();
        let expectedPageSize = 0;

        for (
          let page = 1;
          page <= HOME_MAX_SOURCE_PAGES;
          page += 1
        ) {
          const url = new URL(
            '/',
            location.origin
          );

          url.searchParams.set(
            'page',
            String(page)
          );

          const response = await fetch(
            url.href,
            {
              credentials: 'same-origin',
              cache: 'no-cache'
            }
          );

          if (!response.ok) {
            if (page === 1) {
              throw new Error(
                '홈 목록 HTTP ' +
                response.status
              );
            }

            break;
          }

          const doc =
            new DOMParser().parseFromString(
              await response.text(),
              'text/html'
            );

          const pageItems = Array.from(
            doc.querySelectorAll(
              '.list-card ' +
              '.post-list > .post-item'
            )
          );

          if (!pageItems.length) break;

          if (!expectedPageSize) {
            expectedPageSize =
              pageItems.length;
          }

          let rawAdded = 0;

          pageItems.forEach(function (item) {
            const link =
              item.querySelector('a[href]');

            if (!link) return;

            const postUrl =
              normalizedLocalEntryUrl(
                link.getAttribute('href') ||
                link.href
              );

            if (
              !postUrl ||
              seen.has(postUrl)
            ) {
              return;
            }

            seen.add(postUrl);
            rawAdded += 1;

            if (
              nextUrlSet &&
              nextUrlSet.has(postUrl)
            ) {
              return;
            }

            collected.push(
              document.importNode(
                item,
                true
              )
            );
          });

          if (!rawAdded) break;

          if (
            expectedPageSize > 0 &&
            pageItems.length <
              expectedPageSize
          ) {
            break;
          }
        }

        return collected;
      }

      /*
       * ============================================================
       * V6.18.90 · 프로젝트 히스토리 표시 개수
       * ------------------------------------------------------------
       * HISTORY_ARTICLES_PER_PAGE = 기존 호환값 6 (기존 코드 계약 보존)
       *
       * 최신 1개는 본문을 펼쳐서 보여주고,
       * 그 아래 이전 작업기는 한 화면에 5개씩 목록화합니다.
       *
       * 첫 진입 기준:
       *   1번 = 최신 작업기 상세 본문
       *   2~6번 = 이전 작업기 5개 목록
       *
       * HISTORY_OLDER_ARTICLES_PER_PAGE 숫자만 바꾸면
       * 이전 작업기 한 페이지 개수를 직접 조절할 수 있습니다.
       * ============================================================
       */
      const HISTORY_ARTICLES_PER_PAGE = 6;
      const HISTORY_OLDER_ARTICLES_PER_PAGE = 5;
      const HISTORY_MAX_SOURCE_PAGES = 30;

      function historyArticlesPerPage() {
        return HISTORY_ARTICLES_PER_PAGE;
      }

      function historyOlderArticlesPerPage() {
        return HISTORY_OLDER_ARTICLES_PER_PAGE;
      }

      function finishHistoryArticleBoot() {
        document.documentElement.classList.remove(
          'calf-history-booting'
        );
      }

      async function collectHistoryPostItems() {
        const collected = [];
        const seen = new Set();
        let expectedPageSize = 0;

        for (
          let page = 1;
          page <= HISTORY_MAX_SOURCE_PAGES;
          page += 1
        ) {
          const url = new URL(
            NEXT_HISTORY_CATEGORY_URL,
            location.origin
          );

          url.searchParams.set(
            'page',
            String(page)
          );

          const response = await fetch(
            url.href,
            {
              credentials: 'same-origin',
              cache: 'default'
            }
          );

          if (!response.ok) {
            if (page === 1) {
              throw new Error(
                '프로젝트 히스토리 목록 HTTP ' +
                response.status
              );
            }

            break;
          }

          const doc =
            new DOMParser().parseFromString(
              await response.text(),
              'text/html'
            );

          const pageItems = Array.from(
            doc.querySelectorAll(
              '.list-card ' +
              '.post-list > .post-item'
            )
          );

          if (!pageItems.length) break;

          if (!expectedPageSize) {
            expectedPageSize =
              pageItems.length;
          }

          let added = 0;

          pageItems.forEach(function (item) {
            const link =
              item.querySelector('a[href]');

            if (!link) return;

            const postUrl =
              normalizedLocalEntryUrl(
                link.getAttribute('href') ||
                link.href
              );

            if (
              !postUrl ||
              seen.has(postUrl)
            ) {
              return;
            }

            seen.add(postUrl);
            added += 1;

            collected.push(
              document.importNode(
                item,
                true
              )
            );
          });

          if (!added) break;

          if (
            expectedPageSize > 0 &&
            pageItems.length <
              expectedPageSize
          ) {
            break;
          }
        }

        return collected;
      }

      /*
       * ============================================================
       * V6.18.90 · 프로젝트 히스토리 컴팩트 헤더
       * ------------------------------------------------------------
       * 한글화 카테고리와 같은 구조:
       * PROJECT LOG / 프로젝트 히스토리 / 글 수 / 설명
       *
       * 기존 ARTICLE LIST + 큰 제목은 이 페이지에서만 제거합니다.
       * ============================================================
       */
      /*
       * ============================================================
       * V6.18.92 · 프로젝트 히스토리 컴팩트 헤더
       * ------------------------------------------------------------
       * PROJECT LOG / 프로젝트 히스토리 / 글 수 / 설명
       * ============================================================
       */
      /*
       * ============================================================
       * V6.18.93 · 프로젝트 히스토리 LIVE ARTICLE EMBED
       * ------------------------------------------------------------
       * 최신 작업기는 raw HTML을 clone하지 않습니다.
       *
       * 이유:
       * Tistory 댓글/대댓글/공유/반응 UI는 실제 개별 게시글 문서에서
       * React/event listener가 붙어야 정상 작동합니다.
       * fetch + DOMParser + cloneNode()로는 그 런타임 상태가 복제되지 않습니다.
       *
       * 해결:
       * - 최신 실제 permalink를 same-origin iframe으로 로드
       * - iframe 내부 스킨은 ?calf_history_embed=1을 감지하여
       *   헤더/사이드바/푸터만 숨김
       * - 실제 게시글의 본문/댓글/대댓글/버튼은 자기 문서 안에서 그대로 작동
       * - iframe 높이는 ResizeObserver로 내용 높이에 자동 동기화
       * ============================================================
       */

      function installHistoryCompactHeader(
        card,
        initialCount
      ) {
        if (!card) return null;

        const existing =
          card.querySelector(
            '.calf-history-compact-head'
          );

        if (existing) {
          return existing.querySelector(
            '[data-history-archive-count]'
          );
        }

        const oldLabel =
          card.querySelector(
            ':scope > .label'
          );

        const oldTitle =
          card.querySelector(
            ':scope > .page-title'
          );

        const header =
          document.createElement(
            'header'
          );

        header.className =
          'calf-compact-section-head ' +
          'calf-history-compact-head';

        header.innerHTML = `
          <span class="label calf-compact-section-kicker">
            PROJECT LOG
          </span>

          <h2 class="page-title calf-compact-section-title">
            프로젝트 히스토리
          </h2>

          <span
            class="calf-next-panel-count"
            data-history-archive-count>
            ${Math.max(
              0,
              Number(initialCount) || 0
            )}
          </span>

          <span
            class="calf-compact-section-separator"
            aria-hidden="true">
          </span>

          <p class="calf-compact-section-desc">
            분석·한글화·검수의 과정과 시행착오를 작업기 형태로 기록합니다.
          </p>`;

        if (oldLabel) {
          oldLabel.remove();
        }

        if (oldTitle) {
          oldTitle.remove();
        }

        card.insertBefore(
          header,
          card.firstChild
        );

        return header.querySelector(
          '[data-history-archive-count]'
        );
      }


      function historyListItemInfo(item) {
        if (
          !(item instanceof HTMLElement)
        ) {
          return {
            link: null,
            url: '',
            title:
              '프로젝트 작업기',
            date: ''
          };
        }

        const link =
          item.querySelector(
            'a[href]'
          );

        const titleNode =
          item.querySelector(
            '.post-text strong'
          );

        const dateNode =
          item.querySelector(
            '.post-text em'
          );

        const title = (
          (
            link &&
            (
              link.dataset.tiaraCopy ||
              link.dataset.tiaraName
            )
          ) ||
          (
            titleNode
              ? titleNode.textContent
              : ''
          ) ||
          '프로젝트 작업기'
        )
          .replace(/\s+/g, ' ')
          .trim();

        const date = (
          dateNode
            ? dateNode.textContent
            : ''
        )
          .replace(/\s+/g, ' ')
          .trim();

        return {
          link: link,
          url:
            link
              ? (
                  link.getAttribute(
                    'href'
                  ) ||
                  link.href ||
                  ''
                )
              : '',
          title: title,
          date: date
        };
      }


      /*
       * embedded 최신글 permalink.
       * 기존 query string은 보존하고 calf_history_embed=1만 추가합니다.
       */
      function historyEmbedArticleUrl(
        rawUrl
      ) {
        try {
          const url =
            new URL(
              rawUrl,
              location.origin
            );

          url.searchParams.set(
            'calf_history_embed',
            '1'
          );

          url.hash = '';

          return url.href;
        } catch (err) {
          return rawUrl;
        }
      }


      /*
       * 최신 작업기 iframe shell.
       *
       * 페이지 진입 즉시 기존 6개 목록을 이 shell로 교체하므로
       * "목록이 먼저 떴다가 본문이 생기는" flash가 없습니다.
       */
      function buildHistoryLiveFeatured(
        item
      ) {
        const info =
          historyListItemInfo(item);

        const entry =
          document.createElement(
            'article'
          );

        entry.className =
          'calf-history-featured-entry ' +
          'calf-history-live-featured ' +
          'is-loading';

        const head =
          document.createElement(
            'header'
          );

        head.className =
          'calf-history-featured-head';

        head.innerHTML = `
          <span class="calf-history-featured-kicker">
            LATEST WORK LOG
          </span>

          <h3 class="calf-history-featured-title">
            <a href="${esc(info.url)}">
              ${esc(info.title)}
            </a>
          </h3>

          ${
            info.date
              ? `
                <p class="calf-history-featured-date">
                  ${esc(info.date)}
                </p>`
              : ''
          }
        `;

        const stage =
          document.createElement(
            'div'
          );

        stage.className =
          'calf-history-live-stage';

        const loader =
          document.createElement(
            'div'
          );

        loader.className =
          'calf-history-featured-loading';

        loader.setAttribute(
          'role',
          'status'
        );

        loader.setAttribute(
          'aria-live',
          'polite'
        );

        loader.innerHTML = `
          <span
            class="calf-history-featured-loading-pixels"
            aria-hidden="true">
            <i></i><i></i><i></i>
          </span>

          <span>
            최신 작업기 본문과 댓글을 불러오는 중...
          </span>`;

        const frame =
          document.createElement(
            'iframe'
          );

        frame.className =
          'calf-history-live-frame';

        frame.title =
          info.title +
          ' 본문과 댓글';

        frame.loading =
          'eager';

        frame.setAttribute(
          'scrolling',
          'no'
        );

        frame.setAttribute(
          'frameborder',
          '0'
        );

        frame.hidden = true;

        stage.appendChild(
          loader
        );

        stage.appendChild(
          frame
        );

        entry.appendChild(
          head
        );

        entry.appendChild(
          stage
        );

        return {
          entry: entry,
          frame: frame,
          loader: loader,
          info: info
        };
      }


      /*
       * same-origin iframe 높이 자동 동기화.
       * 댓글 React가 늦게 렌더링되거나 대댓글을 펼쳐도 ResizeObserver가
       * 부모 iframe 높이를 다시 맞춰 내부 스크롤바가 생기지 않게 합니다.
       */
      function bindHistoryLiveFrameHeight(
        frame
      ) {
        if (!frame) return;

        let resizeObserver = null;
        let mutationObserver = null;
        let scheduled = false;

        function resize() {
          scheduled = false;

          try {
            const doc =
              frame.contentDocument;

            if (!doc) return;

            const entry =
              doc.querySelector(
                '.entry-card'
              );

            const target =
              entry ||
              doc.querySelector(
                '.fc-main'
              ) ||
              doc.body;

            if (!target) return;

            const rect =
              target.getBoundingClientRect();

            const height =
              Math.max(
                220,
                Math.ceil(
                  Math.max(
                    rect.height,
                    target.scrollHeight || 0
                  )
                ) + 4
              );

            frame.style.height =
              height + 'px';
          } catch (err) {}
        }

        function schedule() {
          if (scheduled) return;

          scheduled = true;

          window.requestAnimationFrame(
            resize
          );
        }

        try {
          const doc =
            frame.contentDocument;

          if (!doc) return;

          const entry =
            doc.querySelector(
              '.entry-card'
            );

          const target =
            entry ||
            doc.body;

          if (target) {
            const ResizeCtor =
              frame.contentWindow &&
              frame.contentWindow.ResizeObserver
                ? frame.contentWindow.ResizeObserver
                : window.ResizeObserver;

            if (ResizeCtor) {
              resizeObserver =
                new ResizeCtor(
                  schedule
                );

              resizeObserver.observe(
                target
              );
            }

            mutationObserver =
              new MutationObserver(
                schedule
              );

            mutationObserver.observe(
              target,
              {
                childList: true,
                subtree: true,
                attributes: true
              }
            );
          }

          [
            0,
            120,
            350,
            800,
            1500,
            3000,
            6000
          ].forEach(
            function (delay) {
              window.setTimeout(
                schedule,
                delay
              );
            }
          );
        } catch (err) {}

        frame._calfResizeObserver =
          resizeObserver;

        frame._calfMutationObserver =
          mutationObserver;
      }


      /*
       * V6.18.124 · 프로젝트 히스토리 LIVE iframe 이미지 확대 FIX
       * ------------------------------------------------------------
       * 최신 작업기 본문은 same-origin iframe으로 삽입되고, iframe 높이는
       * 본문 전체 높이(수천 px)까지 자동 확장됩니다. 이 상태에서 Tistory의
       * 기본 이미지 뷰어(position:fixed)가 iframe 내부에서 열리면, 뷰어가
       * 브라우저 viewport가 아니라 "수천 px짜리 iframe viewport"를 기준으로
       * 잡아 세로로 비정상적으로 길어집니다.
       *
       * 해결은 embedded 최신 작업기 본문의 이미지 클릭만 부모 문서에서
       * 기존 CALF lightbox로 엽니다. 개별 게시글/한글화/NEXT/댓글/방명록의
       * 이미지 동작은 건드리지 않습니다.
       */
      function bindHistoryEmbedImageViewer(
        frame,
        articleTitle
      ) {
        if (!frame) return;

        try {
          const doc = frame.contentDocument;
          if (!doc || doc._calfHistoryImageViewerBound) return;

          const article =
            doc.querySelector(
              '.entry-card .content.article'
            ) ||
            doc.querySelector(
              '#article-view'
            ) ||
            doc.querySelector(
              '.contents_style'
            );

          if (!article) return;

          doc._calfHistoryImageViewerBound = true;

          function collectImages() {
            const nodes = Array.from(
              article.querySelectorAll(
                'figure img, .imageblock img, img[data-origin], img[data-original-url]'
              )
            );

            const seen = new Set();
            const result = [];

            nodes.forEach(function (image) {
              if (!(image instanceof frame.contentWindow.HTMLImageElement)) return;

              if (
                image.closest(
                  '.another_category, .comment-wrap, [data-tistory-react-app="Namecard"]'
                )
              ) {
                return;
              }

              const raw =
                image.getAttribute('data-origin') ||
                image.getAttribute('data-original-url') ||
                image.getAttribute('data-url') ||
                image.currentSrc ||
                image.getAttribute('src') ||
                '';

              let url = '';

              try {
                url = new URL(raw, frame.contentWindow.location.href).href;
              } catch (err) {}

              if (!url || seen.has(url)) return;
              seen.add(url);

              result.push({
                node: image,
                url: url
              });
            });

            return result;
          }

          article.addEventListener(
            'click',
            function (event) {
              const target = event.target;
              const image =
                target && target.closest
                  ? target.closest('img')
                  : null;

              if (!image || !article.contains(image)) return;

              const images = collectImages();
              const index = images.findIndex(
                function (entry) {
                  return entry.node === image;
                }
              );

              if (index < 0 || !images.length) return;

              /* Tistory iframe 내부 기본 viewer보다 먼저 차단합니다. */
              event.preventDefault();
              event.stopPropagation();
              if (event.stopImmediatePropagation) {
                event.stopImmediatePropagation();
              }

              openPatchLightbox(
                images.map(function (entry, imageIndex) {
                  return {
                    type: 'image',
                    url: entry.url,
                    imageIndex: imageIndex
                  };
                }),
                index,
                articleTitle || '프로젝트 작업기'
              );
            },
            true
          );
        } catch (err) {}
      }


      /*
       * iframe load 완료 후 바로 화면에 공개합니다.
       * 실제 comment React는 iframe 문서 안에서 계속 살아 있으므로
       * 댓글/대댓글/수정/답글/공유/반응 동작을 clone하지 않습니다.
       */
      function startHistoryLiveFrame(
        featured
      ) {
        if (
          !featured ||
          !featured.frame ||
          !featured.info.url
        ) {
          return;
        }

        const frame =
          featured.frame;

        const loader =
          featured.loader;

        frame.addEventListener(
          'load',
          function () {
            featured.entry.classList.remove(
              'is-loading'
            );

            if (loader) {
              loader.hidden = true;
            }

            frame.hidden = false;

            bindHistoryEmbedImageViewer(
              frame,
              featured.info.title
            );

            bindHistoryLiveFrameHeight(
              frame
            );
          },
          {
            once: true
          }
        );

        /*
         * src는 shell이 DOM에 들어간 직후 지정해
         * 파서 목록보다 최신 작업기 네트워크 요청을 우선 시작합니다.
         */
        frame.src =
          historyEmbedArticleUrl(
            featured.info.url
          );
      }


      /*
       * V6.18.121 · 최신 작업기 위 패미컴식 '이전 작업기 보기' 접이식 목록
       * ------------------------------------------------------------
       * 아래 PREVIOUS LOG는 그대로 유지합니다.
       * 위쪽에는 버튼만 가볍게 먼저 만들고, 사용자가 펼칠 때에만 같은 5개 pager를
       * clone해서 렌더합니다. 따라서 초기 히스토리 로딩 비용은 거의 늘지 않습니다.
       */
      function buildHistoryTopArchiveToggle(
        host,
        initialOlderItems
      ) {
        if (!host) return null;

        let sourceItems = Array.isArray(initialOlderItems)
          ? initialOlderItems.slice()
          : [];
        let rendered = false;

        const section = document.createElement('section');
        section.className = 'calf-history-top-archive';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'calf-history-top-archive-toggle';
        button.setAttribute('aria-expanded', 'false');
        button.innerHTML = `
          <span class="calf-history-top-archive-kicker">PREVIOUS LOG</span>
          <strong class="calf-history-top-archive-label">이전 작업기 보기</strong>
          <span class="calf-history-top-archive-count">${sourceItems.length}</span>
          <span class="calf-history-top-archive-arrow" aria-hidden="true">▼</span>`;

        const panel = document.createElement('div');
        panel.className = 'calf-history-top-archive-panel';
        panel.hidden = true;

        section.appendChild(button);
        section.appendChild(panel);
        host.appendChild(section);

        function renderPanel() {
          panel.innerHTML = '';

          if (!sourceItems.length) {
            const empty = document.createElement('p');
            empty.className = 'calf-history-top-archive-empty';
            empty.textContent = '이전 작업기가 없습니다.';
            panel.appendChild(empty);
            rendered = true;
            return;
          }

          const clones = sourceItems.map(function (item) {
            return document.importNode(item, true);
          });

          const pager = document.createElement('div');
          pager.className = 'calf-history-article-pager-host calf-history-top-archive-pager';
          panel.appendChild(pager);

          createNextSwipePager(
            pager,
            clones,
            function (item) { return item; },
            {
              listTag: 'ul',
              gridClass: 'post-list calf-history-article-page-grid',
              ariaLabel: '상단 이전 프로젝트 히스토리 게시물 페이지',
              pageSizeResolver: historyOlderArticlesPerPage
            }
          );

          clones.forEach(hydrateOneListThumbnail);
          rendered = true;
        }

        button.addEventListener('click', function () {
          const open = button.getAttribute('aria-expanded') !== 'true';
          button.setAttribute('aria-expanded', open ? 'true' : 'false');
          section.classList.toggle('is-open', open);
          panel.hidden = !open;

          if (open && !rendered) {
            renderPanel();
          }
        });

        return {
          update: function (items) {
            sourceItems = Array.isArray(items) ? items.slice() : [];
            const count = button.querySelector('.calf-history-top-archive-count');
            if (count) count.textContent = String(sourceItems.length);

            if (rendered && button.getAttribute('aria-expanded') === 'true') {
              rendered = false;
              renderPanel();
            } else if (rendered) {
              rendered = false;
              panel.innerHTML = '';
            }
          }
        };
      }


      /*
       * 최신 작업기 아래 이전 작업기 목록.
       * 기존 5개씩 + swipe pager 그대로 유지.
       */
      function buildHistoryOlderPager(
        host,
        olderItems
      ) {
        if (
          !host ||
          !olderItems.length
        ) {
          return;
        }

        const heading =
          document.createElement(
            'header'
          );

        heading.className =
          'calf-history-older-head';

        heading.innerHTML = `
          <span class="calf-history-older-kicker">
            PREVIOUS LOG
          </span>

          <strong class="calf-history-older-title">
            이전 작업기
          </strong>

          <span class="calf-history-older-count">
            ${olderItems.length}
          </span>`;

        host.appendChild(
          heading
        );

        const pager =
          document.createElement(
            'div'
          );

        pager.className =
          'calf-history-article-pager-host';

        host.appendChild(
          pager
        );

        createNextSwipePager(
          pager,
          olderItems,
          function (item) {
            return item;
          },
          {
            listTag: 'ul',
            gridClass:
              'post-list ' +
              'calf-history-article-page-grid',
            ariaLabel:
              '이전 프로젝트 히스토리 게시물 페이지',
            pageSizeResolver:
              historyOlderArticlesPerPage
          }
        );

        olderItems.forEach(
          hydrateOneListThumbnail
        );
      }


      async function initHistoryArticleSwipe() {
        if (
          !isHistoryCategoryPage()
        ) {
          return;
        }

        const card =
          document.querySelector(
            '.list-card'
          );

        const originalList =
          card
            ? card.querySelector(
                '.post-list'
              )
            : null;

        const paging =
          document.getElementById(
            'paging'
          );

        if (
          !card ||
          !originalList
        ) {
          finishHistoryArticleBoot();
          return;
        }

        const initialItems =
          Array.from(
            originalList.querySelectorAll(
              ':scope > .post-item'
            )
          );

        if (!initialItems.length) {
          finishHistoryArticleBoot();
          return;
        }

        const historyCompactCount =
          installHistoryCompactHeader(
            card,
            initialItems.length
          );

        /*
         * ==========================================================
         * FIRST PAINT
         * ----------------------------------------------------------
         * 기존 6개 목록은 calf-history-booting 때문에 아직 안 보입니다.
         * 즉시 최신글 live iframe shell로 교체한 뒤 boot를 해제합니다.
         * ==========================================================
         */
        const host =
          document.createElement(
            'div'
          );

        host.className =
          'calf-history-hybrid-host';

        const featured =
          buildHistoryLiveFeatured(
            initialItems[0]
          );

        const historyTopArchive =
          buildHistoryTopArchiveToggle(
            host,
            initialItems.slice(1)
          );

        host.appendChild(
          featured.entry
        );

        originalList.replaceWith(
          host
        );

        if (paging) {
          paging.hidden = true;
          paging.style.display =
            'none';
        }

        card.classList.add(
          'calf-history-article-dashboard',
          'calf-history-hybrid-dashboard'
        );

        finishHistoryArticleBoot();

        /*
         * 최신 실제 게시글을 가장 먼저 로드.
         */
        startHistoryLiveFrame(
          featured
        );

        /*
         * 과거 목록 수집은 최신 iframe 요청을 시작한 뒤 진행.
         */
        try {
          const items =
            await collectHistoryPostItems();

          if (!items.length) {
            return;
          }

          if (historyCompactCount) {
            historyCompactCount.textContent =
              String(items.length);
          }

          if (historyTopArchive) {
            historyTopArchive.update(
              items.slice(1)
            );
          }

          buildHistoryOlderPager(
            host,
            items.slice(1)
          );
        } catch (err) {
          console.warn(
            '[CALF HISTORY] 이전 작업기 목록 생성 실패',
            err
          );

          if (historyTopArchive) {
            historyTopArchive.update(
              initialItems.slice(1)
            );
          }

          buildHistoryOlderPager(
            host,
            initialItems.slice(1)
          );
        }
      }


      /*
       * ============================================================
       * V6.18.105 · 프로젝트 히스토리 개별 글 화면 통일
       * ------------------------------------------------------------
       * 목표:
       * 프로젝트 히스토리 메인에 펼쳐진 최신글과
       * 카테고리 목록에서 클릭한 개별 작업기의 하단 구성을 동일하게 합니다.
       *
       * 공통 순서:
       *   본문 전체
       *   → 댓글 작성폼
       *   → 댓글/대댓글 전체
       *   → PREVIOUS LOG / 이전 작업기 5개씩
       *
       * 중요:
       * - 댓글을 접지 않습니다.
       * - 댓글/대댓글은 기존 정책 그대로 전부 펼칩니다.
       * - 본문/이미지 DOM은 절대 이동하지 않습니다.
       * - 댓글 DOM도 절대 이동하지 않습니다.
       * - 기존 another_category도 절대 이동하지 않습니다.
       * ============================================================
       */

      function isHistoryDetailArticlePage() {
        if (
          !document.body ||
          document.body.id !== 'tt-body-page'
        ) {
          return false;
        }

        const entry =
          document.querySelector(
            '.entry-card[data-calf-category]'
          );

        if (!entry) {
          return false;
        }

        return (
          String(
            entry.dataset.calfCategory || ''
          )
            .replace(/\s+/g, ' ')
            .trim() ===
          '프로젝트 히스토리'
        );
      }


      /*
       * 현재 보고 있는 개별 글은 PREVIOUS LOG에서 제외합니다.
       */
      function historyDetailCurrentEntryUrl() {
        const entry =
          document.querySelector(
            '.entry-card[data-calf-category="프로젝트 히스토리"]'
          );

        const titleLink =
          entry
            ? entry.querySelector(
                ':scope > .entry-title a[href]'
              )
            : null;

        return normalizedLocalEntryUrl(
          titleLink
            ? titleLink.getAttribute('href')
            : location.pathname
        );
      }


      /*
       * 프로젝트 히스토리 개별 글:
       * 댓글 아래에 메인 페이지와 동일한 PREVIOUS LOG pager를 붙입니다.
       *
       * 실패 안전:
       * - 새 pager가 완성되기 전에는 기존 another_category를 숨기지 않습니다.
       * - 네트워크 실패 시 기존 개별 글 화면이 그대로 남습니다.
       */
      async function initHistoryDetailUnifiedLayout() {
        if (
          !isHistoryDetailArticlePage()
        ) {
          return;
        }

        /*
         * 프로젝트 히스토리 메인의 LIVE iframe은
         * 부모 페이지가 이미 PREVIOUS LOG를 표시하므로
         * iframe 내부에서는 중복 생성하지 않습니다.
         */
        if (
          window.CALF_HISTORY_EMBED_MODE ===
          true
        ) {
          return;
        }

        if (
          document.documentElement.dataset
            .calfHistoryDetailUnified ===
          '1'
        ) {
          return;
        }

        document.documentElement.dataset
          .calfHistoryDetailUnified =
          '1';

        document.documentElement
          .classList.add(
            'calf-history-detail-doc'
          );

        const entry =
          document.querySelector(
            '.entry-card[data-calf-category="프로젝트 히스토리"]'
          );

        const comment =
          entry
            ? entry.querySelector(
                '.comment-wrap'
              )
            : null;

        if (
          !entry ||
          !comment
        ) {
          return;
        }

        /*
         * 댓글은 기존 Tistory DOM 그대로 유지합니다.
         * initCommunityComposerPlacement()가 이미
         * 작성폼 → 댓글수 → 댓글목록 순서를 담당합니다.
         */
        try {
          const allItems =
            await collectHistoryPostItems();

          const currentUrl =
            historyDetailCurrentEntryUrl();

          const olderItems =
            allItems.filter(
              function (item) {
                const info =
                  historyListItemInfo(item);

                return (
                  !currentUrl ||
                  normalizedLocalEntryUrl(
                    info.url
                  ) !== currentUrl
                );
              }
            );

          if (!olderItems.length) {
            return;
          }

          const host =
            document.createElement(
              'section'
            );

          host.className =
            'calf-history-detail-previous-host';

          /*
           * 메인 페이지에서 이미 쓰는 동일 함수를 재사용합니다.
           * PREVIOUS LOG 라벨 / 이전 작업기 / 글 수 /
           * 5개씩 pager / 썸네일 / 도트 / 드래그가 전부 동일합니다.
           */
          buildHistoryOlderPager(
            host,
            olderItems
          );

          if (!host.children.length) {
            return;
          }

          comment.insertAdjacentElement(
            'afterend',
            host
          );

          /*
           * 새 PREVIOUS LOG가 정상적으로 만들어진 뒤에만
           * 본문 속 Tistory 기본 another_category를 숨깁니다.
           *
           * 따라서 pager 생성 실패 시 기존 목록이 남는 안전 fallback입니다.
           */
          document.documentElement
            .classList.add(
              'calf-history-detail-unified-ready'
            );
        } catch (err) {
          console.warn(
            '[CALF HISTORY] 개별 글 PREVIOUS LOG 생성 실패 - 기존 화면 유지',
            err
          );
        }
      }


      async function initHomeArticleSwipe() {
        if (!isHomePage()) return;

        const card =
          document.querySelector(
            '.list-card'
          );

        const originalList = card
          ? card.querySelector(
              '.post-list'
            )
          : null;

        const paging =
          document.getElementById(
            'paging'
          );

        if (!card || !originalList) {
          finishHomeArticleBoot();
          return;
        }

        try {
          let nextUrlSet =
            readNextFeedCache();

          if (!nextUrlSet) {
            nextUrlSet =
              await collectNextProgressUrls();

            writeNextFeedCache(
              nextUrlSet
            );
          }

          const items =
            await collectHomePostItems(
              nextUrlSet
            );

          if (!items.length) {
            finishHomeArticleBoot();
            return;
          }

          const host =
            document.createElement('div');

          host.className =
            'calf-home-article-pager-host';

          originalList.insertAdjacentElement(
            'beforebegin',
            host
          );

          originalList.remove();

          createNextSwipePager(
            host,
            items,
            function (item) {
              return item;
            },
            {
              listTag: 'ul',
              gridClass:
                'post-list ' +
                'calf-home-article-page-grid',
              ariaLabel:
                '전체 게시물 페이지',
              pageSizeResolver:
                homeArticlesPerPage
            }
          );

          if (paging) {
            paging.hidden = true;
            paging.style.display = 'none';
          }

          card.classList.add(
            'calf-home-article-dashboard'
          );

          items.forEach(
            hydrateOneListThumbnail
          );

          finishHomeArticleBoot();
        } catch (err) {
          console.warn(
            '[CALF HOME] 전체 글 드래그 목록 생성 실패',
            err
          );

          finishHomeArticleBoot();
        }
      }

      function hydrateListThumbnails() {
        if (
          isNextCategoryPage() ||
          isHomePage() ||
          isHistoryCategoryPage()
        ) {
          return;
        }
        const items=Array.from(document.querySelectorAll('.post-item')).slice(0,20);
        items.forEach(hydrateOneListThumbnail);
      }


      function findArticleSource(el) {
        let node = el.nextElementSibling;

        while (node) {
          if (node.classList && node.classList.contains('calf-patch-article-source')) {
            return node;
          }

          const isSpacer =
            (node.tagName === 'P' || node.tagName === 'DIV') &&
            !(node.textContent || '').trim() &&
            !node.querySelector('img,iframe,video');

          if (!isSpacer) break;
          node = node.nextElementSibling;
        }

        return null;
      }

      function sourceSection(source, name) {
        if (!source) return '';
        const section = source.querySelector('[data-calf-section="' + name + '"]');
        return section ? section.innerHTML.trim() : '';
      }

      function normalizeChangeListHtml(html) {
        if (!html) return '';

        const template = document.createElement('template');
        template.innerHTML = html;

        const lists = template.content.querySelectorAll('ul.calf-change-list');

        lists.forEach(function (list) {
          if (list.querySelector(':scope > li > ul')) return;

          const originalItems = Array.from(list.children).filter(function (node) {
            return node.tagName === 'LI';
          });

          if (!originalItems.length) return;

          const rebuilt = document.createElement('ul');
          rebuilt.className = list.className || 'calf-change-list';

          let currentSublist = null;
          let foundGroup = false;

          originalItems.forEach(function (item) {
            const text = (item.textContent || '').replace(/\s+/g, ' ').trim();
            const isGroup = /^\[[^\]\r\n]{1,80}\]$/.test(text);

            if (isGroup) {
              foundGroup = true;

              const groupItem = document.createElement('li');
              groupItem.className = 'calf-change-group';

              /*
               * [V6.18.56 · 자동 변경목록 소제목]
               * [전체 한글화] / [화면 및 UI] 같은 그룹명을
               * 단순 굵은 글자가 아니라 실제 H4 소제목으로 변환합니다.
               * 대괄호는 제거해 글작성기 제목 계층과 같은 디자인을 사용합니다.
               */
              const heading = document.createElement('h4');
              heading.className = 'calf-change-group-title';
              heading.textContent = text.replace(/^\[|\]$/g, '').trim();

              currentSublist = document.createElement('ul');
              currentSublist.className = 'calf-change-sublist';

              groupItem.appendChild(heading);
              groupItem.appendChild(currentSublist);
              rebuilt.appendChild(groupItem);
              return;
            }

            const cloned = document.createElement('li');
            cloned.innerHTML = item.innerHTML;

            if (currentSublist) {
              currentSublist.appendChild(cloned);
            } else {
              rebuilt.appendChild(cloned);
            }
          });

          if (foundGroup) {
            list.replaceWith(rebuilt);
          }
        });

        return template.innerHTML.trim();
      }

      function titledSection(title, html, className) {
        if (!html) return '';
        return `
          <h2>${esc(title)}</h2>
          <div class="${className}">${html}</div>
        `;
      }

      /*
       * ============================================================
       * V6.18.60 · 대표 이미지 자동 종횡비 맞춤
       * ------------------------------------------------------------
       * 목적:
       * - 사용자가 320px / 360px를 패치마다 직접 맞출 필요가 없게 합니다.
       * - 실제 이미지 naturalWidth / naturalHeight를 읽습니다.
       * - 왼쪽 패치정보 5행의 실제 높이를 기준으로
       *   대표 이미지가 잘리지 않고 최대한 프레임을 채우는 너비를 계산합니다.
       *
       * 핵심:
       * - 세로 높이는 표 5행에 맞춰 고정
       * - 가로폭만 이미지 원본 비율에 맞춰 자동 변경
       * - 결과적으로 object-fit: contain이어도 불필요한 검은 여백이 거의 사라집니다.
       * ============================================================
       */
      function initAutoPatchCoverFit(root) {
        const layout = root.querySelector('.calf-patch-info-lshape');
        const main = root.querySelector('.calf-patch-info-main');
        const slot = root.querySelector('.calf-patch-info-cover-slot');
        const figure = slot ? slot.querySelector('.calf-patch-cover') : null;
        const img = figure ? figure.querySelector('img') : null;
        const caption = figure ? figure.querySelector('figcaption') : null;

        if (!layout || !main || !slot || !figure || !img) return;

        let scheduled = false;

        function cssPx(name, fallback) {
          const raw = getComputedStyle(document.documentElement)
            .getPropertyValue(name)
            .trim();

          const value = parseFloat(raw);
          return Number.isFinite(value) ? value : fallback;
        }

        function apply() {
          scheduled = false;

          if (!img.naturalWidth || !img.naturalHeight) return;

          const mainHeight = main.getBoundingClientRect().height;
          const captionHeight = caption
            ? caption.getBoundingClientRect().height
            : 0;

          const redBorder = cssPx('--calf-patch-cover-red-border', 4);
          const shadow = cssPx('--calf-patch-cover-shadow', 6);
          const minWidth = cssPx('--calf-patch-cover-auto-min', 220);
          const maxWidth = cssPx('--calf-patch-cover-auto-max', 430);

          /*
           * figure는 우/하단 금색 그림자가 들어갈 공간만큼
           * 슬롯보다 약간 작게 그려집니다.
           */
          const figureHeight = Math.max(
            60,
            mainHeight - shadow
          );

          /*
           * 실제 이미지가 차지할 수 있는 세로 높이:
           * figure 전체 높이
           * - 빨간 상/하 테두리
           * - 캡션 높이
           */
          const imageHeight = Math.max(
            40,
            figureHeight
              - (redBorder * 2)
              - captionHeight
          );

          const naturalRatio =
            img.naturalWidth / img.naturalHeight;

          /*
           * 원본 비율을 보존하면서 이미지가 세로 공간을 정확히 채우는
           * 이미지 가로폭을 계산한 뒤 프레임/그림자 폭까지 더합니다.
           */
          const desiredWidth =
            (imageHeight * naturalRatio)
            + (redBorder * 2)
            + shadow;

          /*
           * 너무 넓은 이미지가 왼쪽 표를 과도하게 압축하지 않도록
           * 최소/최대 범위만 안전하게 제한합니다.
           */
          const autoWidth = Math.round(
            Math.max(
              minWidth,
              Math.min(maxWidth, desiredWidth)
            )
          );

          layout.style.setProperty(
            '--calf-auto-cover-width',
            autoWidth + 'px'
          );

          /*
           * 자동 계산 후에는 전체 이미지가 잘리지 않도록 contain 사용.
           * 열 폭 자체가 원본 비율에 맞기 때문에 수동 폭 조절 때 생기던
           * 큰 검은 여백/과한 확대가 대부분 사라집니다.
           */
          img.style.objectFit = 'contain';
          img.style.objectPosition = 'center center';
        }

        function schedule() {
          if (scheduled) return;
          scheduled = true;
          requestAnimationFrame(function () {
            apply();

            /*
             * 너비가 바뀌면 캡션 줄바꿈 높이도 바뀔 수 있으므로
             * 한 프레임 뒤 한 번 더 계산해 최종값을 안정화합니다.
             */
            requestAnimationFrame(apply);
          });
        }

        if (img.complete) {
          schedule();
        } else {
          img.addEventListener('load', schedule, { once: true });
        }

        /*
         * 브라우저 폭/폰트 렌더링/표 높이가 달라져도 자동 재계산합니다.
         */
        if ('ResizeObserver' in window) {
          const observer = new ResizeObserver(schedule);
          observer.observe(main);
          observer.observe(layout);
        } else {
          window.addEventListener('resize', schedule, { passive: true });
        }
      }

      function renderAutoPatch(el) {
        const config = {
          title: getData(el, 'title', '게임명 미입력'),
          platform: getData(el, 'platform', '기종 미입력'),
          version: getData(el, 'version', 'v1.0'),
          original: getData(el, 'original', '원본 기준 미입력'),
          crc32: getData(el, 'crc32', '').replace(/^0x/i, '').trim().toUpperCase(),
          sha1: getData(el, 'sha1', '').replace(/\s+/g, '').trim().toUpperCase(),
          sha256: getData(el, 'sha256', '').replace(/\s+/g, '').trim().toUpperCase(),
          patchedSize: getData(el, 'patchedSize', '').trim(),
          patchedCrc32: getData(el, 'patchedCrc32', '').replace(/^0x/i, '').trim().toUpperCase(),
          patchedSha1: getData(el, 'patchedSha1', '').replace(/\s+/g, '').trim().toUpperCase(),
          patchedSha256: getData(el, 'patchedSha256', '').replace(/\s+/g, '').trim().toUpperCase(),
          patchUrl: getData(el, 'patchUrl', ''),
          author: getData(el, 'author', '꽃송아지'),
          date: getData(el, 'date', ''),
          note: getData(
            el,
            'note',
            '원본 ROM은 제공하지 않습니다. 방문자가 보유한 원본 파일을 브라우저 안에서 직접 패치합니다.'
          ),
          media: getData(el, 'media', 'cartridge').trim().toLowerCase(),
          thumbnail: getData(el, 'thumbnail', '').trim(),
          coverImage: getData(el, 'coverImage', '').trim(),
          coverCaption: getData(el, 'coverCaption', '').trim(),
          images: [1,2,3,4,5,6,7].map(function (index) {
            return getData(el, 'image' + index, '').trim();
          }).filter(Boolean),
          video: getData(
            el,
            'video1',
            getData(el, 'video', '')
          ).trim()
        };

        if (!config.patchUrl) {
          el.innerHTML = '<div class="warning-box">패치 파일 경로가 비어 있습니다. data-patch-url 값을 입력하세요.</div>';
          return;
        }

        let patcherEmbedUrl;
        let patcherOpenUrl;

        try {
          patcherEmbedUrl = buildPatcherUrl(config, true);
          patcherOpenUrl = buildPatcherUrl(config, false);
        } catch (err) {
          el.innerHTML = '<div class="warning-box">패처 주소 생성 실패: ' + esc(err.message || err) + '</div>';
          return;
        }

        const source = findArticleSource(el);
        const introHtml = sourceSection(source, 'intro');
        const changesHtml = normalizeChangeListHtml(
          sourceSection(source, 'changes')
        );
        const storyHtml = sourceSection(source, 'story');
        const testsHtml = sourceSection(source, 'tests');
        const galleryHtml = buildGallery(config);
        const coverHtml = buildCoverImage(config);

        /*
         * ==========================================================
         * V6.18.55 · 패치 정보 + 대표 이미지 컴팩트 레이아웃
         * ----------------------------------------------------------
         * 기존 문제:
         * 대표 이미지가 표 아래에서 전체 폭을 사용해 지나치게 크게 보였습니다.
         *
         * 새 구성:
         * [왼쪽] 게임명 / 기종 / 패치 버전 / 원본 기준
         * [오른쪽] 대표 이미지 — 왼쪽 4개 행과 같은 세로 영역
         *
         * 그 아래:
         * CRC32 / SHA-1 / SHA-256 / 출력 파일명은 다시 전체 폭을 사용합니다.
         *
         * 장점:
         * - 대표 이미지가 과하게 커지지 않음
         * - 긴 SHA 문자열은 충분한 가로폭 유지
         * - 패치 정보 전체가 한 덩어리로 보임
         * ==========================================================
         */
        /*
         * [V6.18.60 · 대표 이미지 5행 기준]
         * CRC32까지 상단 표에 포함시켜 대표 이미지가
         * 게임명/기종/패치버전/원본기준/CRC32 총 5행 높이에 맞춰집니다.
         */
        const patchInfoTopTable = `
          <table class="calf-patch-info-table calf-patch-info-primary">
            <tbody>
              <tr><th>게임명</th><td>${esc(config.title)}</td></tr>
              <tr><th>기종</th><td>${esc(config.platform)}</td></tr>
              <tr><th>패치 버전</th><td>${esc(config.version)}</td></tr>
              <tr><th>원본 기준</th><td>${esc(config.original)}</td></tr>
              <tr><th>원본 CRC32</th><td>${config.crc32 ? esc(config.crc32) : '미지정'}</td></tr>
            </tbody>
          </table>
        `;

        const patchInfoHashTable = `
          <table class="calf-patch-info-table calf-patch-info-secondary">
            <tbody>
              <tr><th>원본 SHA-1</th><td class="calf-hash-value">${config.sha1 ? esc(config.sha1) : '미지정'}</td></tr>
              <tr><th>원본 SHA-256</th><td class="calf-hash-value">${config.sha256 ? esc(config.sha256) : '미지정'}</td></tr>
              <tr><th>출력 파일명</th><td>원본 파일명 + <strong>(K-patched)</strong></td></tr>
            </tbody>
          </table>
        `;

        /*
         * [V6.18.56 · 패치 정보 ㄴ자 레이아웃]
         *
         * cover가 있을 때:
         *
         * ┌───────────────┬─────────┐
         * │ 게임명        │         │
         * │ 기종          │ 대표    │
         * │ 패치 버전     │ 이미지  │
         * │ 원본 기준     │         │
         * ├───────────────┴─────────┤
         * │ CRC32                    │
         * │ SHA-1                    │
         * │ SHA-256                  │
         * │ 출력 파일명              │
         * └───────────────────────────┘
         *
         * CRC32가 위 표와 떨어지지 않고 같은 grid 안에서 바로 이어집니다.
         */
        const patchInfoHtml = coverHtml
          ? `
              <div class="calf-patch-info-lshape">
                <div class="calf-patch-info-main">
                  ${patchInfoTopTable}
                </div>

                <div class="calf-patch-info-cover-slot">
                  ${coverHtml}
                </div>

                <div class="calf-patch-info-bottom">
                  ${patchInfoHashTable}
                </div>
              </div>
            `
          : `
              <div class="calf-patch-info-lshape no-cover">
                <div class="calf-patch-info-main">
                  ${patchInfoTopTable}
                </div>

                <div class="calf-patch-info-bottom">
                  ${patchInfoHashTable}
                </div>
              </div>
            `;

        const introCombinedHtml = [
          introHtml,
          changesHtml
            ? '<div class="calf-patch-changes-inline">' + changesHtml + '</div>'
            : ''
        ].filter(Boolean).join('');

        const introSection = titledSection(
          '패치 소개',
          introCombinedHtml,
          'calf-patch-prose'
        );
        const storySection = titledSection('작업 이야기', storyHtml, 'calf-patch-prose');
        const testsSection = titledSection('최종 테스트', testsHtml, 'calf-patch-details');

        el.innerHTML = `
          <div class="patch-box calf-auto-warning">
            <strong>주의</strong><br>
            ${esc(config.note)}
          </div>

          <h2>패치 정보</h2>
          ${patchInfoHtml}
          ${introSection}
          ${galleryHtml}
          ${storySection}
          ${testsSection}

          <h2>한국어화 패치 방법</h2>
          <ol>
            <li>보유한 원본 ROM 파일을 준비합니다.</li>
            <li>아래 패처에서 원본 파일을 선택하거나 끌어다 놓습니다.</li>
            <li>CRC32·SHA-1·SHA-256 검증값이 일치하는지 확인합니다.</li>
            <li><strong>패치하기</strong> 버튼을 누릅니다.</li>
            <li>원본명 뒤에 <strong>(K-patched)</strong>가 붙은 파일을 받습니다.</li>
          </ol>

          <div class="calf-rompatcher-box">
            <h2>패치 하기</h2>

            <div class="calf-patcher-frame-wrap">
              <iframe
                class="calf-patcher-frame"
                src="${esc(patcherEmbedUrl)}"
                title="${esc(config.title + ' ' + config.version + ' 웹 패처')}"
                loading="lazy"
                referrerpolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts allow-same-origin allow-downloads allow-forms"
                scrolling="no"
              ></iframe>
            </div>

            <p class="calf-patcher-fallback">
              화면이 표시되지 않으면
              <a class="calf-patcher-open" href="${esc(patcherOpenUrl)}" target="_blank" rel="noopener">
                새 창에서 패처 열기
              </a>
            </p>
          </div>

          <h2>버전 기록</h2>
          <p><strong>${esc(config.date || config.version)}</strong> ${esc(config.version)} 공개</p>

          <h2>제작진</h2>
          <p>한국어화 패치: ${esc(config.author)}</p>

          <div class="warning-box calf-legal-notice">
            <strong>법적 고지</strong>
            <p>이 자료는 비공식·비상업 팬 한국어화 패치입니다.</p>
            <ul class="calf-legal-list">
              <li>게임 ROM은 포함되어 있지 않습니다.</li>
              <li>원작 게임, 상표, 로고, 캐릭터 및 관련 권리는 각 원 저작권자에게 있습니다.</li>
              <li>사용자는 합법적으로 보유한 게임에서 직접 ROM을 준비해야 합니다.</li>
              <li>패치 또는 패치된 ROM을 유료 판매하거나 ROM과 함께 재배포하지 마십시오.</li>
              <li>수정 또는 재배포 시 원 제작자 표기와 홈페이지 주소를 유지해 주십시오.</li>
              <li>공유 시 출처를 남겨주십시오.</li>
            </ul>
          </div>
        `;

        /*
         * [대표 이미지 자동 맞춤 실행]
         * DOM이 생성된 직후 실제 이미지 비율과 5행 표 높이를 읽어
         * 오른쪽 열 폭을 자동 계산합니다.
         */
        initAutoPatchCoverFit(el);

        mountPatchMediaGallery(
          el,
          config
        );

        if (source) source.remove();
      }

      function initAutoPatch() {
        const blocks = document.querySelectorAll('.calf-patch-auto');
        if (!blocks.length) return;

        blocks.forEach(function (block) {
          renderAutoPatch(block);
        });
      }

      window.addEventListener('message', function (event) {
        if (event.origin !== PATCHER_ORIGIN) return;
        if (!event.data || event.data.type !== 'calf-patcher-height') return;

        const height = Number(event.data.height);
        if (!Number.isFinite(height) || height < 360 || height > 1600) return;

        document.querySelectorAll('.calf-patcher-frame').forEach(function (frame) {
          if (frame.contentWindow !== event.source) return;
          const nextHeight = Math.ceil(height);
          const currentHeight = Math.round(frame.getBoundingClientRect().height);
          if (Math.abs(currentHeight - nextHeight) > 1) {
            frame.style.height = nextHeight + 'px';
          }
        });
      });


      /*
       * ================================================================
       * V6.18.112 · HOME COMMENT CLEAN TRANSFER
       * ----------------------------------------------------------------
       * 홈 최근댓글 클릭:
       *
       *   /23#comment23947722   ← 사용하지 않음
       *
       * 대신:
       *   1) 링크 href는 /23
       *   2) 클릭 순간 comment ID를 sessionStorage에 임시 저장
       *   3) /23이 정상 로드
       *   4) Tistory 댓글 렌더 + 기존 최신순 정렬 완료 후 자동 스크롤
       *
       * URL hash와 Tistory React 초기 렌더가 충돌하지 않습니다.
       * 본문/댓글 DOM 순서도 변경하지 않습니다.
       * ================================================================ */

      const COMMENT_TRANSFER_STORAGE_KEY =
        'calf-home-comment-target-v1';

      const COMMENT_TRANSFER_TTL_MS =
        2 * 60 * 1000;


      function saveHomeCommentTransfer(
        pagePath,
        commentId
      ) {
        if (
          !pagePath ||
          !/^comment\d+$/i.test(
            String(commentId || '')
          )
        ) {
          return;
        }

        try {
          sessionStorage.setItem(
            COMMENT_TRANSFER_STORAGE_KEY,
            JSON.stringify({
              path: pagePath,
              commentId: commentId,
              savedAt: Date.now()
            })
          );
        } catch (err) {}
      }


      function readHomeCommentTransfer() {
        try {
          const raw =
            sessionStorage.getItem(
              COMMENT_TRANSFER_STORAGE_KEY
            );

          if (!raw) {
            return null;
          }

          const parsed =
            JSON.parse(raw);

          if (
            !parsed ||
            !parsed.path ||
            !/^comment\d+$/i.test(
              String(parsed.commentId || '')
            ) ||
            !Number.isFinite(parsed.savedAt)
          ) {
            sessionStorage.removeItem(
              COMMENT_TRANSFER_STORAGE_KEY
            );

            return null;
          }

          if (
            Date.now() -
              parsed.savedAt >
            COMMENT_TRANSFER_TTL_MS
          ) {
            sessionStorage.removeItem(
              COMMENT_TRANSFER_STORAGE_KEY
            );

            return null;
          }

          return parsed;
        } catch (err) {
          return null;
        }
      }


      function clearHomeCommentTransfer() {
        try {
          sessionStorage.removeItem(
            COMMENT_TRANSFER_STORAGE_KEY
          );
        } catch (err) {}
      }


      /*
       * 홈 댓글 행에 클릭 저장만 담당.
       * preventDefault 하지 않으므로 /글번호 이동은 브라우저 기본 동작.
       */
      function initHomeFriendCommentTransferLinks() {
        const root =
          document.querySelector(
            '[data-home-friend-comments]'
          );

        if (
          !root ||
          root.dataset
            .calfCommentTransferReady ===
            '1'
        ) {
          return;
        }

        root.dataset
          .calfCommentTransferReady =
            '1';

        root.addEventListener(
          'click',
          function (event) {
            const link =
              event.target.closest(
                '.calf-home-friend-link[data-calf-target-comment]'
              );

            if (!link) {
              return;
            }

            saveHomeCommentTransfer(
              link.getAttribute('href') || '',
              link.dataset
                .calfTargetComment || ''
            );
          }
        );
      }


      function initTransferredCommentScroll() {
        if (
          !document.body ||
          document.body.id !==
            'tt-body-page'
        ) {
          return;
        }

        const transfer =
          readHomeCommentTransfer();

        if (!transfer) {
          return;
        }

        const currentPath =
          location.pathname
            .replace(/\/+$/, '') ||
          '/';

        const targetPath =
          String(transfer.path)
            .split('#')[0]
            .split('?')[0]
            .replace(/\/+$/, '') ||
          '/';

        if (
          currentPath !==
          targetPath
        ) {
          return;
        }

        const commentRoot =
          document.querySelector(
            '.comment-wrap'
          );

        if (!commentRoot) {
          return;
        }

        const targetId =
          transfer.commentId;

        let done = false;
        let observer = null;

        function stickyOffset() {
          const parsed =
            parseFloat(
              getComputedStyle(
                document.documentElement
              )
                .getPropertyValue(
                  '--calf-sticky-nav-height'
                )
            );

          return Number.isFinite(parsed)
            ? parsed
            : 52;
        }

        function findTarget() {
          const direct =
            document.getElementById(
              targetId
            );

          if (
            direct &&
            commentRoot.contains(direct)
          ) {
            return direct;
          }

          const numeric =
            targetId.replace(
              /^comment/i,
              ''
            );

          return (
            commentRoot.querySelector(
              `[id="${targetId}"]`
            ) ||
            commentRoot.querySelector(
              `[data-comment-id="${numeric}"]`
            ) ||
            commentRoot.querySelector(
              `[data-reply-id="${numeric}"]`
            ) ||
            commentRoot.querySelector(
              `[data-id="${numeric}"]`
            )
          );
        }

        function sorterSettled(node) {
          const item =
            node.closest(
              'li.tt-item-reply'
            );

          let list =
            item
              ? item.closest(
                  'ul.tt-list-reply'
                )
              : null;

          while (
            list &&
            list.closest(
              'li.tt-item-reply'
            )
          ) {
            const parent =
              list.closest(
                'li.tt-item-reply'
              );

            list =
              parent
                ? parent.closest(
                    'ul.tt-list-reply'
                  )
                : null;
          }

          return (
            !list ||
            list.dataset
              .calfOrderNewest ===
              '1'
          );
        }

        function scrollToTarget(node) {
          const item =
            node.closest(
              'li.tt-item-reply'
            ) ||
            node;

          window.scrollTo({
            top: Math.max(
              0,
              item.getBoundingClientRect().top +
                window.scrollY -
                stickyOffset() -
                14
            ),
            behavior: 'auto'
          });

          const reply =
            node.closest(
              'li.tt-item-reply'
            );

          if (reply) {
            reply.classList.add(
              'calf-comment-transfer-target'
            );

            window.setTimeout(
              function () {
                reply.classList.remove(
                  'calf-comment-transfer-target'
                );
              },
              1500
            );
          }
        }

        const startedAt =
          performance.now();

        function finish(node) {
          if (done) {
            return;
          }

          done = true;

          if (observer) {
            observer.disconnect();
          }

          clearHomeCommentTransfer();
          scrollToTarget(node);

          [120, 380].forEach(
            function (delay) {
              window.setTimeout(
                function () {
                  const latest =
                    findTarget();

                  if (latest) {
                    scrollToTarget(latest);
                  }
                },
                delay
              );
            }
          );
        }

        function attempt() {
          if (done) {
            return;
          }

          const node =
            findTarget();

          if (!node) {
            return;
          }

          if (
            sorterSettled(node) ||
            performance.now() -
              startedAt >= 900
          ) {
            finish(node);
          }
        }

        observer =
          new MutationObserver(
            function (mutations) {
              if (
                mutations.some(
                  function (mutation) {
                    return (
                      mutation.type ===
                      'childList'
                    );
                  }
                )
              ) {
                attempt();
              }
            }
          );

        observer.observe(
          commentRoot,
          {
            childList: true,
            subtree: true
          }
        );

        [
          0,
          80,
          180,
          360,
          700,
          1100,
          1800,
          3000,
          4800
        ].forEach(
          function (delay) {
            window.setTimeout(
              attempt,
              delay
            );
          }
        );

        window.setTimeout(
          function () {
            if (
              !done &&
              observer
            ) {
              observer.disconnect();
            }
          },
          6200
        );
      }


      function initBackToTop() {
        const button = document.getElementById('calf-back-to-top');
        if (!button) return;

        let ticking = false;

        function updateButton() {
          /*
           * V6.18.76
           * 짧아진 홈/한글패치 페이지에서 "페이지 하단이 가깝다"는 이유만으로
           * 첫 화면부터 위로가기 버튼이 뜨던 조건을 제거했습니다.
           * 이제 실제로 아래 값만큼 스크롤한 뒤에만 표시됩니다.
           * 값은 style.css의 --calf-back-to-top-show-after 로 조절합니다.
           */
          const rawThreshold = getComputedStyle(document.documentElement)
            .getPropertyValue('--calf-back-to-top-show-after');
          const threshold = Math.max(0, parseFloat(rawThreshold) || 500);
          const hasScrolled = window.scrollY > threshold;

          button.classList.toggle('is-visible', hasScrolled);
          ticking = false;
        }

        function requestUpdate() {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(updateButton);
        }

        button.addEventListener('click', function () {
          const reduceMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)'
          ).matches;

          window.scrollTo({
            top: 0,
            behavior: reduceMotion ? 'auto' : 'smooth'
          });
        });

        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate);
        updateButton();
      }


      function decorateTistoryNamecard() {
        const root = document.querySelector(
          'div[data-tistory-react-app="Namecard"]'
        );

        if (!root) return false;

        root.classList.add('calf-namecard-decorated');

        const images = Array.from(root.querySelectorAll('img')).filter(
          function (image) {
            return !image.classList.contains('calf-namecard-brand-image');
          }
        );

        if (!images.length) return true;

        /*
         * 티스토리 네임카드에는 보통 프로필 이미지가 한 장뿐입니다.
         * 표시 중인 마지막 이미지를 관리자 쿠니오 아이콘으로 간주합니다.
         */
        const avatar = images
          .filter(function (image) {
            const style = window.getComputedStyle(image);

            return (
              style.display !== 'none' &&
              style.visibility !== 'hidden'
            );
          })
          .pop();

        if (!avatar) return true;

        avatar.classList.add('calf-namecard-avatar');

        const slot =
          avatar.closest('a') ||
          avatar.parentElement;

        if (slot && slot !== root) {
          slot.classList.add('calf-namecard-avatar-slot');
        }

        return true;
      }

      function initTistoryNamecardDecoration() {
        let scheduled = false;

        function scheduleDecoration() {
          if (scheduled) return;

          scheduled = true;

          window.requestAnimationFrame(function () {
            scheduled = false;
            decorateTistoryNamecard();
          });
        }

        const observer = new MutationObserver(function (mutations) {
          const relevant = mutations.some(function (mutation) {
            return mutation.type === 'childList';
          });

          if (relevant) {
            scheduleDecoration();
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true
        });

        scheduleDecoration();
        window.setTimeout(scheduleDecoration, 300);
        window.setTimeout(scheduleDecoration, 900);
        window.setTimeout(scheduleDecoration, 1800);
      }

      /*
       * ============================================================
       * V6.18.55 · 모든 댓글 작성폼 상단 배치
       * ------------------------------------------------------------
       * 적용 대상:
       * - 일반 게시글 댓글
       * - 일반 게시글 대댓글 목록이 있는 페이지
       * - 방명록
       *
       * 화면 순서:
       *   작성폼 → 댓글/방명록 개수 → 댓글·대댓글 목록
       *
       * Tistory 댓글 UI는 React가 늦게 렌더링하거나 DOM을 다시 만들 수 있으므로
       * MutationObserver + 지연 재시도로 클래스가 계속 유지되게 합니다.
       * ============================================================
       */
      /*
       * ============================================================
       * V6.18.81 · 방명록 FAST BOOT + INSTANT SNAPSHOT
       * ------------------------------------------------------------
       * 방명록은 Tistory React 댓글 DOM이 늦게 붙는 구조라,
       * DOMContentLoaded까지 기다리면 체감상 한 박자 더 늦게 보일 수 있습니다.
       * body 하단에서 방명록 껍데기가 만들어진 즉시 observer를 먼저 연결해
       * 실제 목록이 들어오는 순간 바로 후처리합니다.
       *
       * [조절 포인트]
       * - 아래 함수는 페이지 판별만 담당합니다.
       * - 애니메이션/두더지/익사이트/패치 목록 코드는 건드리지 않습니다.
       * ============================================================
       */
      function isGuestbookRuntimePage() {
        let path = location.pathname;

        try {
          path = decodeURIComponent(path);
        } catch (err) {}

        return (
          (document.body && document.body.id === 'tt-body-guestbook') ||
          /^\/guestbook\/?$/i.test(path)
        );
      }


      /*
       * ============================================================
       * V6.18.81 · GUESTBOOK INSTANT SNAPSHOT
       * ------------------------------------------------------------
       * Tistory 방명록의 실제 댓글/방명록 목록은 React가 늦게 붙일 수 있습니다.
       * 이 지연은 스킨만으로 0ms로 만들 수 없으므로, 마지막으로 정상 표시됐던
       * 첫 페이지 목록을 로컬 캐시에 저장해 다음 방문 때 즉시 보여줍니다.
       *
       * 동작:
       * 1) 이전 방문 스냅샷이 있으면 .guestbook-wrap에 즉시 화면용 복사본 표시
       * 2) Tistory의 진짜 목록이 들어오는 순간 복사본 제거
       * 3) 최신 진짜 목록을 다시 캐시에 저장
       *
       * 안전:
       * - 복사본에서는 form/button/input/id/href/onclick을 제거합니다.
       * - 따라서 오래된 복사본에서 답글/수정 같은 동작이 실행되지 않습니다.
       * - 실제 목록이 뜨면 즉시 교체됩니다.
       * - 공개 방명록 첫 페이지의 '보기용' 스냅샷만 저장합니다.
       *
       * 조절:
       * GUESTBOOK_CACHE_TTL_MS = 캐시 유효시간. 현재 30분.
       * ============================================================
       */
      const GUESTBOOK_CACHE_KEY = 'calf-guestbook-firstpage-preview-v3-sorted';
      const GUESTBOOK_CACHE_TTL_MS = 30 * 60 * 1000;
      const GUESTBOOK_CACHE_MAX_CHARS = 420000;

      function guestbookTopList(scope, ignorePreview) {
        if (!scope) return null;

        const lists = Array.from(
          scope.querySelectorAll('ul.tt-list-reply')
        );

        return lists.find(function (list) {
          if (
            ignorePreview &&
            list.closest('.calf-guestbook-cache-preview')
          ) {
            return false;
          }

          return (
            !list.closest('li.tt-item-reply') &&
            Array.from(list.children).some(function (child) {
              return (
                child instanceof HTMLElement &&
                child.matches('li.tt-item-reply')
              );
            })
          );
        }) || null;
      }

      function readGuestbookSnapshot() {
        try {
          const raw = localStorage.getItem(GUESTBOOK_CACHE_KEY);
          if (!raw) return null;

          const data = JSON.parse(raw);
          if (!data || typeof data.html !== 'string' || !data.savedAt) return null;

          if (Date.now() - Number(data.savedAt) > GUESTBOOK_CACHE_TTL_MS) {
            localStorage.removeItem(GUESTBOOK_CACHE_KEY);
            return null;
          }

          return data;
        } catch (err) {
          return null;
        }
      }

      function saveGuestbookSnapshot(list) {
        if (!(list instanceof HTMLElement)) return;
        if (list.closest('.calf-guestbook-cache-preview')) return;

        /*
         * V6.18.88:
         * 원댓글 최신순 + 대댓글 오래된→최신 정책이 실제 DOM에 적용된 뒤의
         * 목록만 캐시합니다. 잘못된 순서를 빠르게 보여 주는 snapshot은 저장하지 않습니다.
         */
        if (
          list.dataset.calfOrderNewest !== '1' ||
          list.dataset.calfReplyOrderOldest !== '1'
        ) {
          return;
        }

        try {
          const clone = list.cloneNode(true);

          clone.querySelectorAll(
            'script, style, form, button, input, textarea, select, iframe'
          ).forEach(function (node) {
            node.remove();
          });

          clone.querySelectorAll('[id]').forEach(function (node) {
            node.removeAttribute('id');
          });

          clone.querySelectorAll('[onclick]').forEach(function (node) {
            node.removeAttribute('onclick');
          });

          const html = clone.outerHTML;
          if (!html || html.length > GUESTBOOK_CACHE_MAX_CHARS) return;

          localStorage.setItem(
            GUESTBOOK_CACHE_KEY,
            JSON.stringify({
              savedAt: Date.now(),
              html: html
            })
          );
        } catch (err) {
          /* 저장 실패는 방명록 실제 기능에 영향 없음 */
        }
      }

      function mountGuestbookSnapshot(root) {
        if (!root || guestbookTopList(root, true)) return null;
        if (root.querySelector('.calf-guestbook-cache-preview')) {
          return root.querySelector('.calf-guestbook-cache-preview');
        }

        const snapshot = readGuestbookSnapshot();
        if (!snapshot) return null;

        const preview = document.createElement('div');
        preview.className = 'calf-guestbook-cache-preview';
        preview.setAttribute('aria-hidden', 'true');
        preview.innerHTML = snapshot.html;

        preview.querySelectorAll('[id]').forEach(function (node) {
          node.removeAttribute('id');
        });

        preview.querySelectorAll('a').forEach(function (link) {
          link.removeAttribute('href');
          link.removeAttribute('target');
          link.removeAttribute('onclick');
          link.setAttribute('tabindex', '-1');
        });

        root.insertBefore(preview, root.firstChild);
        return preview;
      }

      function initGuestbookInstantSnapshot() {
        if (!isGuestbookRuntimePage()) return;

        const root = document.querySelector('.guestbook-wrap');
        if (!root || root.dataset.calfGuestbookInstantReady === '1') return;
        root.dataset.calfGuestbookInstantReady = '1';

        let preview = mountGuestbookSnapshot(root);
        let saveTimer = 0;
        let settleTimer = 0;

        function persistLiveList() {
          const liveList = guestbookTopList(root, true);
          if (!liveList) return false;

          if (preview && preview.isConnected) {
            preview.remove();
            preview = null;
          }

          if (saveTimer) window.clearTimeout(saveTimer);
          saveTimer = window.setTimeout(function () {
            saveGuestbookSnapshot(liveList);
          }, 900);

          return true;
        }

        const observer = new MutationObserver(function () {
          if (!persistLiveList()) return;

          /* React가 첫 목록 직후 한두 번 더 DOM을 정리할 수 있어 잠깐만 감시 유지 */
          if (settleTimer) window.clearTimeout(settleTimer);
          settleTimer = window.setTimeout(function () {
            persistLiveList();
            observer.disconnect();
          }, 1800);
        });

        observer.observe(root, {
          childList: true,
          subtree: true
        });

        if (persistLiveList()) {
          settleTimer = window.setTimeout(function () {
            persistLiveList();
            observer.disconnect();
          }, 1800);
        }
      }

      function initCommunityComposerPlacement() {
        const roots = Array.from(
          document.querySelectorAll(
            '.comment-wrap, .guestbook-wrap'
          )
        );

        if (!roots.length) return;

        roots.forEach(function (root) {
          /*
           * FAST BOOT 선실행 + DOMContentLoaded 본실행이 겹쳐도
           * 같은 방명록/댓글 루트에 MutationObserver를 두 번 만들지 않습니다.
           */
          if (root.dataset.calfComposerPlacementReady === '1') return;
          root.dataset.calfComposerPlacementReady = '1';

          let scheduled = false;

          function decorate() {
            scheduled = false;

            const commentCont = root.querySelector(
              '.tt-comment-cont'
            );

            if (!commentCont) return false;

            const writeArea = commentCont.querySelector(
              '.tt-area-write'
            );

            const form = writeArea
              ? writeArea.closest('form')
              : null;

            if (!form) return false;

            /*
             * 공통 클래스:
             * CSS flex order로 작성폼을 댓글 개수/목록보다 먼저 표시합니다.
             */
            commentCont.classList.add(
              'calf-community-compose-top'
            );

            form.classList.add(
              'calf-community-compose-form'
            );

            /*
             * 기존 방명록 전용 클래스도 유지합니다.
             * 과거 CSS/브라우저 캐시와의 호환을 위한 안전장치입니다.
             */
            if (
              root.classList.contains(
                'guestbook-wrap'
              )
            ) {
              commentCont.classList.add(
                'calf-guestbook-compose-top'
              );

              form.classList.add(
                'calf-guestbook-compose-form'
              );
            }

            return true;
          }

          function schedule() {
            if (scheduled) return;
            scheduled = true;

            window.requestAnimationFrame(
              decorate
            );
          }

          /*
           * Tistory가 댓글 DOM을 다시 렌더링해도
           * 작성폼 상단 배치 클래스를 다시 적용합니다.
           */
          const observer = new MutationObserver(
            schedule
          );

          observer.observe(root, {
            childList: true,
            subtree: true
          });

          decorate();

          /*
           * 느린 네트워크/React 렌더링 대응 재검사
           */
          /*
           * [방명록 작성폼 후처리 재검사]
           * 예전 250 / 800 / 1800ms보다 앞당겨 첫 화면 정착을 빠르게 합니다.
           * Tistory React가 아주 늦게 붙는 경우는 MutationObserver가 계속 담당합니다.
           */
          window.setTimeout(schedule, 80);
          window.setTimeout(schedule, 260);
          window.setTimeout(schedule, 700);
        });
      }


      function initGuestbookInfiniteScroll() {
        /*
         * ============================================================
         * V6.18.119 · 방명록 10개 단위 STABLE INFINITE
         * ------------------------------------------------------------
         * 정책:
         * - 처음 원댓글 10개만 표시
         * - 사용자가 실제로 아래로 스크롤해 목록 끝 근처에 도달하면 다음 10개
         * - 한 번에 최대 10개만 추가
         * - 대댓글은 부모 원댓글과 함께 표시되며 별도 개수로 세지 않음
         *
         * V87의 수동 '10개 더 보기' 버튼은 제거했습니다.
         * 버튼/자동 재시도 때문에 로딩 UI가 반복되는 현상을 없애고,
         * 실제 사용자 스크롤만 다음 묶음을 여는 기준으로 사용합니다.
         *
         * 직접 조절:
         * GUESTBOOK_INFINITE_BATCH_SIZE = 한 묶음 원댓글 수
         * GUESTBOOK_INFINITE_TRIGGER_MARGIN_PX = 화면 하단 감지 여유
         * GUESTBOOK_INFINITE_SCROLL_STEP_PX = 다음 묶음에 필요한 실제 추가 스크롤량
         * ============================================================
         */
        let guestbookPath = location.pathname;

        try {
          guestbookPath = decodeURIComponent(guestbookPath);
        } catch (err) {}

        const isGuestbookPage =
          (
            document.body &&
            document.body.id === 'tt-body-guestbook'
          ) ||
          /^\/guestbook\/?$/i.test(guestbookPath);

        if (!isGuestbookPage) return;

        const root = document.querySelector('.guestbook-wrap');
        const paging = document.getElementById('paging');

        if (!root) return;

        /*
         * V6.18.126 · 현재 Tistory React "이전 댓글 더보기" 자동 흡수
         * ------------------------------------------------------------
         * Tistory가 댓글/방명록 수가 많을 때 삽입하는 기본 더보기 UI는
         * CALF의 10개 배치 UX와 중복되고, 첫 화면에 큰 막대가 노출됩니다.
         *
         * - CSS에서 첫 페인트부터 완전히 숨김
         * - native control은 페이지당 딱 한 번만 자동 click
         * - native가 가져온 원댓글은 기존 CALF visibleLimit=10 로직이 다시 숨김
         * - 따라서 사용자는 Tistory 기본 버튼을 전혀 보지 않고,
         *   기존 최신순 + 10개 배치 + 스크롤 추가 로딩 UX만 사용합니다.
         */
        let nativeMoreConsumed = false;

        function consumeNativeGuestbookMoreOnce() {
          if (nativeMoreConsumed) return false;

          /*
           * 현재 Tistory React는 구형 tt_more_preview_comments_*가 아니라
           * ul.tt-list-reply > li > button.tt_btn_prev_more 구조를 사용합니다.
           * 구형 클래스도 fallback으로 남겨 기존 스킨/렌더 변형을 함께 방어합니다.
           */
          const control =
            root.querySelector('.tt_btn_prev_more') ||
            document.querySelector('#tt-body-guestbook .tt_btn_prev_more') ||
            root.querySelector('.tt_more_preview_comments_text') ||
            document.querySelector(
              '#tt-body-guestbook .tt_more_preview_comments_text'
            );

          if (!control) return false;

          const wrap =
            control.closest('.tt_more_preview_comments_wrap') ||
            control.closest('li') ||
            control.parentElement;

          nativeMoreConsumed = true;

          if (wrap instanceof HTMLElement) {
            wrap.dataset.calfNativeMoreConsumed = '1';
          }
          control.dataset.calfNativeMoreConsumed = '1';

          try {
            control.click();
            return true;
          } catch (err) {
            console.warn(
              '[CALF GUESTBOOK] native 이전 댓글 자동 흡수 실패',
              err
            );
            return false;
          }
        }

        /* 이미 native control이 만들어져 있으면 첫 프레임 전에 바로 흡수 */
        consumeNativeGuestbookMoreOnce();

        const GUESTBOOK_INFINITE_BATCH_SIZE = 10;
        const GUESTBOOK_INFINITE_TRIGGER_MARGIN_PX = 80;
        const GUESTBOOK_INFINITE_SCROLL_STEP_PX = 80;

        function findTopLevelList(scope) {
          if (!scope) return null;

          const lists = Array.from(
            scope.querySelectorAll('ul.tt-list-reply')
          );

          return (
            lists.find(function (list) {
              return (
                !list.closest('li.tt-item-reply') &&
                Array.from(list.children).some(function (child) {
                  return (
                    child instanceof HTMLElement &&
                    child.matches('li.tt-item-reply')
                  );
                })
              );
            }) ||
            lists.find(function (list) {
              return !list.closest('li.tt-item-reply');
            }) ||
            null
          );
        }

        /*
         * React가 목록을 늦게 붙이는 경우: 루트는 유지하고 목록 등장만 기다립니다.
         */
        if (
          root.dataset.calfGuestbookInfinite === 'ready'
        ) {
          return;
        }

        let targetList = findTopLevelList(root);

        if (!targetList) {
          if (
            root.dataset.calfGuestbookInfinite === 'waiting'
          ) {
            return;
          }

          root.dataset.calfGuestbookInfinite = 'waiting';

          let settled = false;

          const waitObserver = new MutationObserver(function () {
            if (settled) return;

            consumeNativeGuestbookMoreOnce();

            const found = findTopLevelList(root);
            if (!found) return;

            settled = true;
            waitObserver.disconnect();
            window.clearTimeout(waitTimer);

            delete root.dataset.calfGuestbookInfinite;
            initGuestbookInfiniteScroll();
          });

          waitObserver.observe(root, {
            childList: true,
            subtree: true
          });

          const waitTimer = window.setTimeout(function () {
            if (settled) return;

            settled = true;
            waitObserver.disconnect();
            delete root.dataset.calfGuestbookInfinite;

            console.warn(
              '[CALF GUESTBOOK] React 목록 생성 대기 시간 초과'
            );
          }, 15000);

          return;
        }

        root.dataset.calfGuestbookInfinite = 'ready';

        document.documentElement.classList.add(
          'calf-guestbook-infinite-ready'
        );

        if (paging) {
          paging.hidden = true;
          paging.style.display = 'none';
        }

        /*
         * 기존 V87 UI가 DOM에 남아 있으면 먼저 제거합니다.
         * React 재렌더 후 재초기화되는 경우 중복 UI를 방지합니다.
         */
        root.querySelectorAll(
          '.calf-guestbook-infinite'
        ).forEach(function (node) {
          node.remove();
        });

        const ui = document.createElement('div');
        ui.className = 'calf-guestbook-infinite';

        ui.innerHTML = `
          <div
            class="calf-guestbook-infinite-loader"
            role="status"
            aria-live="polite"
            hidden>
            <span
              class="calf-guestbook-loader-pixels"
              aria-hidden="true">
              <i></i><i></i><i></i>
            </span>
            <span
              class="calf-guestbook-loader-text">
              이전 방명록을 불러오는 중
            </span>
          </div>

          <p
            class="calf-guestbook-infinite-end"
            hidden>
            모든 방명록을 불러왔습니다.
          </p>

          <div
            class="calf-guestbook-infinite-sentinel"
            aria-hidden="true">
          </div>
        `;

        targetList.insertAdjacentElement('afterend', ui);

        const loader = ui.querySelector(
          '.calf-guestbook-infinite-loader'
        );
        const endMessage = ui.querySelector(
          '.calf-guestbook-infinite-end'
        );
        const sentinel = ui.querySelector(
          '.calf-guestbook-infinite-sentinel'
        );

        let loading = false;
        let finished = false;
        let visibleLimit = GUESTBOOK_INFINITE_BATCH_SIZE;
        let lastBatchScrollY =
          window.scrollY || window.pageYOffset || 0;
        let scheduled = false;
        let normalizing = false;
        let nextUrl = '';
        let activeRequestUrl = '';
        let activeFetchPromise = null;

        const visitedPages = new Set();
        const knownEntries = new Set();

        function normalizePageUrl(value, baseUrl) {
          const raw = String(value || '').trim();

          if (
            !raw ||
            raw === '#' ||
            /^javascript:/i.test(raw)
          ) {
            return '';
          }

          try {
            const url = new URL(
              raw,
              baseUrl || location.href
            );

            if (url.origin !== location.origin) {
              return '';
            }

            return url.href;
          } catch (err) {
            return '';
          }
        }

        function findNextPageUrl(doc, baseUrl) {
          const pageRoot = doc.querySelector('#paging');
          if (!pageRoot) return '';

          const anchors = Array.from(
            pageRoot.querySelectorAll('a')
          );

          const next = anchors.find(function (anchor) {
            const text = String(
              anchor.textContent || ''
            )
              .replace(/\s+/g, '')
              .trim();

            const className = String(
              anchor.className || ''
            ).toLowerCase();

            const rel = String(
              anchor.getAttribute('rel') || ''
            ).toLowerCase();

            const disabled =
              className.includes('no-more-next') ||
              className.includes('no_more_next') ||
              className.includes('disabled') ||
              anchor.getAttribute('aria-disabled') === 'true';

            if (disabled) return false;

            return (
              rel === 'next' ||
              text === '다음' ||
              text === '›' ||
              text === '>'
            );
          });

          return next
            ? normalizePageUrl(
                next.getAttribute('href') || next.href,
                baseUrl || location.href
              )
            : '';
        }

        function parseEntryTime(item) {
          if (!(item instanceof HTMLElement)) return 0;

          const dateNode =
            item.querySelector(
              ':scope > .tt-wrap-cmt .tt_date, ' +
              ':scope > .tt-wrap-cmt time, ' +
              ':scope > div .tt_date, ' +
              ':scope > div time'
            ) ||
            item.querySelector('.tt_date, time');

          if (!dateNode) return 0;

          /*
           * V6.18.89:
           * 방명록 10개 배치 정렬도 공용 댓글과 동일하게
           * 상대시간("2시간 전" 등)을 실제 최신시각으로 해석합니다.
           */
          const attrCandidates = [
            dateNode.getAttribute('datetime'),
            dateNode.getAttribute('data-time'),
            dateNode.getAttribute('data-date'),
            dateNode.getAttribute('data-timestamp')
          ].filter(Boolean);

          for (const raw of attrCandidates) {
            const numeric = Number(raw);

            if (Number.isFinite(numeric) && numeric > 0) {
              const ms =
                numeric < 100000000000
                  ? numeric * 1000
                  : numeric;

              if (Number.isFinite(ms)) return ms;
            }

            const parsed = Date.parse(raw);
            if (Number.isFinite(parsed)) return parsed;
          }

          const value = String(dateNode.textContent || '')
            .replace(/\s+/g, ' ')
            .trim();

          const absolute = value.match(
            /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*(\d{1,2}):(\d{2})/
          );

          if (absolute) {
            const time = new Date(
              Number(absolute[1]),
              Number(absolute[2]) - 1,
              Number(absolute[3]),
              Number(absolute[4]),
              Number(absolute[5])
            ).getTime();

            if (Number.isFinite(time)) return time;
          }

          const now = Date.now();

          if (/방금|지금/.test(value)) {
            return now;
          }

          const relative = value.match(
            /(\d+)\s*(초|분|시간|일|주)\s*전/
          );

          if (relative) {
            const amount = Number(relative[1]);

            const unitMs = {
              '초': 1000,
              '분': 60 * 1000,
              '시간': 60 * 60 * 1000,
              '일': 24 * 60 * 60 * 1000,
              '주': 7 * 24 * 60 * 60 * 1000
            };

            const delta =
              amount *
              (unitMs[relative[2]] || 0);

            if (delta > 0) {
              return now - delta;
            }
          }

          const todayOrYesterday = value.match(
            /(오늘|어제)(?:\s+(\d{1,2}):(\d{2}))?/
          );

          if (todayOrYesterday) {
            const date = new Date();

            if (todayOrYesterday[1] === '어제') {
              date.setDate(date.getDate() - 1);
            }

            date.setHours(
              todayOrYesterday[2]
                ? Number(todayOrYesterday[2])
                : 0,
              todayOrYesterday[3]
                ? Number(todayOrYesterday[3])
                : 0,
              0,
              0
            );

            return date.getTime();
          }

          return 0;
        }

        function numericGuestbookId(item) {
          if (!(item instanceof HTMLElement)) return 0;

          const candidates = [
            item.id || '',
            item.getAttribute('data-id') || '',
            item.getAttribute('data-reply-id') || '',
            item.getAttribute('data-comment-id') || ''
          ];

          for (const value of candidates) {
            const nums = String(value).match(/\d+/g);
            if (!nums || !nums.length) continue;

            const number = Number(nums[nums.length - 1]);
            if (
              Number.isFinite(number) &&
              number > 0
            ) {
              return number;
            }
          }

          return 0;
        }

        function guestbookEntryKey(item) {
          const id = numericGuestbookId(item);
          if (id) return 'id:' + id;

          const date = parseEntryTime(item);
          const author = (
            item.querySelector('.tt-link-user')?.textContent || ''
          )
            .replace(/\s+/g, ' ')
            .trim();

          const body = (
            item.querySelector('.tt_desc')?.textContent || ''
          )
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 160);

          return (
            'fallback:' +
            date +
            ':' +
            author +
            ':' +
            body
          );
        }

        function directEntries(list) {
          if (!(list instanceof HTMLElement)) return [];

          return Array.from(list.children).filter(function (item) {
            return (
              item instanceof HTMLElement &&
              item.matches('li.tt-item-reply')
            );
          });
        }

        function sortEntriesNewest(items) {
          return items
            .map(function (item, index) {
              return {
                item: item,
                time: parseEntryTime(item),
                id: numericGuestbookId(item),
                index: index
              };
            })
            .sort(function (a, b) {
              if (
                a.time &&
                b.time &&
                a.time !== b.time
              ) {
                return b.time - a.time;
              }

              if (
                a.id &&
                b.id &&
                a.id !== b.id
              ) {
                return b.id - a.id;
              }

              return a.index - b.index;
            })
            .map(function (record) {
              return record.item;
            });
        }

        function sortTargetListNewest() {
          const current = directEntries(targetList);
          if (current.length < 2) {
            targetList.dataset.calfOrderNewest = '1';
            return;
          }

          const sorted = sortEntriesNewest(current);

          const same = sorted.every(function (item, index) {
            return item === current[index];
          });

          if (!same) {
            const marker = document.createComment(
              'calf-guestbook-newest-anchor'
            );

            targetList.insertBefore(marker, current[0]);

            const fragment = document.createDocumentFragment();

            sorted.forEach(function (item) {
              fragment.appendChild(item);
            });

            targetList.insertBefore(fragment, marker);
            marker.remove();
          }

          targetList.dataset.calfOrderNewest = '1';
        }

        function rememberKnownEntries() {
          directEntries(targetList).forEach(function (item) {
            knownEntries.add(guestbookEntryKey(item));
          });
        }

        function applyBatchVisibility() {
          const entries = directEntries(targetList);

          entries.forEach(function (item, index) {
            const visible = index < visibleLimit;

            item.hidden = !visible;
            item.classList.toggle(
              'calf-guestbook-batch-hidden',
              !visible
            );
          });
        }

        function hiddenEntryCount() {
          return Math.max(
            0,
            directEntries(targetList).length - visibleLimit
          );
        }

        function moveUiAfterTargetList() {
          if (
            ui.isConnected &&
            ui.previousElementSibling === targetList
          ) {
            return;
          }

          targetList.insertAdjacentElement('afterend', ui);
        }

        function normalizeLiveList() {
          if (normalizing || !targetList.isConnected) return;

          normalizing = true;

          try {
            sortTargetListNewest();
            rememberKnownEntries();
            applyBatchVisibility();
            moveUiAfterTargetList();
          } finally {
            normalizing = false;
          }
        }

        function setLoading(value, showUi) {
          loading = Boolean(value);
          const visible = loading && showUi !== false;

          if (loader) {
            loader.hidden = !visible;
          }

          ui.classList.toggle('is-loading', visible);
        }

        function finishIfDone() {
          const noLocalHidden = hiddenEntryCount() <= 0;

          if (
            noLocalHidden &&
            !nextUrl &&
            !loading
          ) {
            finished = true;
            sentinel.hidden = true;
            endMessage.hidden = false;
          } else {
            finished = false;
            sentinel.hidden = false;
            endMessage.hidden = true;
          }
        }

        function appendFetchedEntries(sourceList) {
          const sourceEntries = sortEntriesNewest(
            directEntries(sourceList)
          );

          const fragment = document.createDocumentFragment();
          let added = 0;

          sourceEntries.forEach(function (item) {
            const key = guestbookEntryKey(item);

            if (knownEntries.has(key)) return;

            knownEntries.add(key);

            const imported = document.importNode(item, true);
            imported.classList.add(
              'calf-guestbook-infinite-added',
              'calf-guestbook-batch-hidden'
            );
            imported.hidden = true;

            fragment.appendChild(imported);
            added += 1;
          });

          if (added) {
            targetList.appendChild(fragment);
          }

          return added;
        }

        async function fetchOlderEntriesIfNeeded(options) {
          const silent = Boolean(options && options.silent);

          if (
            hiddenEntryCount() > 0 ||
            !nextUrl
          ) {
            return;
          }

          /*
           * V6.18.119:
           * 이미 백그라운드 prefetch가 진행 중이면 같은 요청을 또 만들지 않고
           * 그 Promise를 공유합니다. 사용자가 아주 빨리 하단에 도달한 경우에도
           * 기존 요청 완료 직후 바로 다음 10개를 펼칠 수 있습니다.
           */
          if (activeFetchPromise) {
            return activeFetchPromise;
          }

          const requestUrl = normalizePageUrl(
            nextUrl,
            location.href
          );

          if (
            !requestUrl ||
            visitedPages.has(requestUrl)
          ) {
            nextUrl = '';
            return;
          }

          activeRequestUrl = requestUrl;
          setLoading(true, !silent);

          activeFetchPromise = (async function () {
            try {
              const response = await fetch(
                requestUrl,
                {
                  credentials: 'same-origin',
                  cache: 'no-cache',
                  headers: {
                    'X-Requested-With':
                      'CALF-Guestbook-Infinite'
                  }
                }
              );

              if (!response.ok) {
                throw new Error('HTTP ' + response.status);
              }

              const text = await response.text();
              const doc = new DOMParser().parseFromString(
                text,
                'text/html'
              );

              const sourceRoot = doc.querySelector(
                '.guestbook-wrap'
              );
              const sourceList = findTopLevelList(sourceRoot);

              if (!sourceRoot || !sourceList) {
                throw new Error('방명록 목록을 찾지 못했습니다.');
              }

              visitedPages.add(requestUrl);

              appendFetchedEntries(sourceList);

              nextUrl = findNextPageUrl(
                doc,
                requestUrl
              );

              normalizeLiveList();
            } catch (err) {
              console.warn(
                '[CALF GUESTBOOK] 이전 방명록 fetch 실패',
                err
              );
            } finally {
              activeRequestUrl = '';
              setLoading(false, false);
            }
          })();

          try {
            return await activeFetchPromise;
          } finally {
            activeFetchPromise = null;
          }
        }

        function scheduleSilentOlderPrefetch() {
          if (
            finished ||
            loading ||
            activeFetchPromise ||
            hiddenEntryCount() > 0 ||
            !nextUrl
          ) {
            return;
          }

          const run = function () {
            fetchOlderEntriesIfNeeded({ silent: true })
              .then(function () {
                finishIfDone();
              });
          };

          /*
           * 첫 10개는 먼저 보여주고, 브라우저가 한숨 돌린 직후
           * '다음 페이지 10개'만 조용히 받아 숨겨 둡니다.
           * 따라서 최초 10개 제한은 유지하면서 하단 도달 시에는 즉시 펼쳐집니다.
           */
          if ('requestIdleCallback' in window) {
            window.requestIdleCallback(run, { timeout: 900 });
          } else {
            window.setTimeout(run, 180);
          }
        }

        async function revealNextBatch() {
          if (loading || finished) return;

          /*
           * 현재 DOM에 숨겨진 글이 없으면 다음 Tistory 페이지를 한 번만 요청.
           */
          if (hiddenEntryCount() <= 0) {
            await fetchOlderEntriesIfNeeded({ silent: false });
          }

          const beforeCount = directEntries(targetList).length;

          if (hiddenEntryCount() > 0) {
            visibleLimit += GUESTBOOK_INFINITE_BATCH_SIZE;
            normalizeLiveList();
          }

          const afterCount = directEntries(targetList).length;

          /*
           * 한 묶음 처리 후 현재 스크롤 위치로 gate를 다시 잠급니다.
           * 화면 축소 상태에서도 10→20→30개가 한 번에 연속으로 열리지 않습니다.
           */
          lastBatchScrollY =
            window.scrollY ||
            window.pageYOffset ||
            0;

          finishIfDone();

          /* 다음 10개는 표시하지 않고 백그라운드에서만 준비 */
          scheduleSilentOlderPrefetch();

          if (
            beforeCount === afterCount &&
            hiddenEntryCount() <= 0 &&
            !nextUrl
          ) {
            finishIfDone();
          }
        }

        function shouldLoadByScroll() {
          if (
            loading ||
            finished ||
            !sentinel.isConnected
          ) {
            return false;
          }

          const currentY =
            window.scrollY ||
            window.pageYOffset ||
            0;

          if (
            currentY <
            lastBatchScrollY +
            GUESTBOOK_INFINITE_SCROLL_STEP_PX
          ) {
            return false;
          }

          const rect = sentinel.getBoundingClientRect();

          return (
            rect.top <=
            window.innerHeight +
            GUESTBOOK_INFINITE_TRIGGER_MARGIN_PX
          );
        }

        function checkScroll() {
          scheduled = false;

          if (shouldLoadByScroll()) {
            revealNextBatch();
          }
        }

        function scheduleScrollCheck() {
          if (scheduled) return;

          scheduled = true;
          window.requestAnimationFrame(checkScroll);
        }

        /*
         * React가 같은 방명록 목록을 다시 그리거나 ul 자체를 교체해도
         * '최신순 + 현재 visibleLimit'을 다시 적용합니다.
         */
        let liveObserverScheduled = false;

        const liveObserver = new MutationObserver(function () {
          if (normalizing || liveObserverScheduled) return;
          liveObserverScheduled = true;

          window.requestAnimationFrame(function () {
            liveObserverScheduled = false;

            consumeNativeGuestbookMoreOnce();

            const latestList = findTopLevelList(root);

            if (
              latestList &&
              latestList !== targetList
            ) {
              targetList = latestList;
              normalizeLiveList();
            } else if (latestList) {
              normalizeLiveList();
            }

            finishIfDone();
          });
        });

        liveObserver.observe(root, {
          childList: true,
          subtree: true
        });

        /*
         * 현재 문서의 native 다음 페이지를 한 번만 읽습니다.
         * 이후 fetch 페이지에서는 그 페이지의 #paging에서 nextUrl을 갱신합니다.
         */
        nextUrl = findNextPageUrl(
          document,
          location.href
        );

        normalizeLiveList();
        finishIfDone();
        scheduleSilentOlderPrefetch();

        window.addEventListener(
          'scroll',
          scheduleScrollCheck,
          { passive: true }
        );

        window.addEventListener(
          'resize',
          scheduleScrollCheck
        );
      }


      /*
       * V6.18.78 · 한글패치 목록 초고속 선실행
       * 이 script는 body 하단에 있으므로 목록 DOM은 이미 존재합니다.
       * DOMContentLoaded를 기다리지 않고 즉시 아카이브 카드로 변환해
       * 진입 직후 빈 화면/0개 표시 시간을 줄입니다.
       */
      if (isPatchCategoryPage()) {
        initPatchArchiveCategoryPage();
      }

      /*
       * HOTFIX8 · NEXT 초고속 선실행
       * ------------------------------------------------------------
       * 이 스크립트는 body 하단에 있으므로 NEXT의 실제 글 목록 DOM은
       * 이미 만들어진 상태입니다. DOMContentLoaded를 기다리지 않고
       * 여기서 즉시 카드 골격/대시보드를 구성합니다.
       */
      if (isNextCategoryPage()) {
        initNextProgressDashboard();
      }

      /*
       * V6.18.81 · 방명록 초고속 선실행
       * ------------------------------------------------------------
       * 방명록은 Tistory가 실제 글 목록을 React로 늦게 삽입할 수 있습니다.
       * DOMContentLoaded 이후에 observer를 붙이면 그만큼 한 박자 늦어지므로,
       * 방명록 루트가 이미 존재하는 body 하단에서 즉시 감시를 시작합니다.
       * 목록이 아직 없어도 initGuestbookInfiniteScroll() 내부 waiting observer가
       * 실제 ul.tt-list-reply가 생기는 순간 바로 이어서 초기화합니다.
       */
      if (isGuestbookRuntimePage()) {
        initGuestbookInstantSnapshot();
        initCommunityComposerPlacement();
        initGuestbookInfiniteScroll();
      }

      function startCalfSkin() {
        /*
         * [방명록 전용 FAST PATH]
         * 방명록에서는 패처·패치목록·NEXT·히스토리처럼 관계없는 초기화 함수를
         * 전부 돌리지 않습니다. 첫 화면에 필요한 것만 실행해 메인 스레드 일을 줄입니다.
         */
        if (isGuestbookRuntimePage()) {
          initGuestbookInstantSnapshot();
          initCommunityComposerPlacement();
          initGuestbookInfiniteScroll();
          initBackToTop();

          /*
           * 프로필/네임카드 장식은 첫 글 표시보다 중요도가 낮으므로
           * 첫 페인트 뒤 idle 시간에 처리합니다.
           * timeout은 requestIdleCallback을 지원하지 않는 브라우저용 안전장치입니다.
           */
          if ('requestIdleCallback' in window) {
            window.requestIdleCallback(
              initTistoryNamecardDecoration,
              { timeout: 1400 }
            );
          } else {
            window.setTimeout(initTistoryNamecardDecoration, 700);
          }

          return;
        }

        initAutoPatch();
        hydrateListThumbnails();

        /*
         * V6.18.80: 최근 게시물 UI를 사이트 전체에서 제거했습니다.
         * NEXT 글 숨김 필터는 '분류 전체보기/검색' 같은 일반 글목록에서만
         * 필요하므로 홈·한글화·NEXT·히스토리에서는 불필요한 fetch를 생략합니다.
         */
        if (
          document.querySelector('.list-card .post-list') &&
          !isHomePage() &&
          !isPatchCategoryPage() &&
          !isNextCategoryPage() &&
          !isHistoryCategoryPage()
        ) {
          initHideNextPostsFromFeeds();
        }
        /* V6.18.73: 홈은 4분할 랜딩 대시보드가 담당합니다. */
        /* initHomeArticleSwipe(); */
        initHistoryArticleSwipe();

        /*
         * NEXT는 위 HOTFIX8 FAST PATH에서 이미 선실행됩니다.
         * 다른 페이지에서만 기존 호출 경로를 유지합니다.
         */
        if (!isNextCategoryPage()) {
          initNextProgressDashboard();
        }

        initPatchArchiveCategoryPage();
        initCommunityComposerPlacement();

        /*
         * V6.18.105 · 프로젝트 히스토리 통일
         * 댓글은 전부 펼친 기존 상태를 유지하고,
         * 개별 작업기에도 메인과 동일한 PREVIOUS LOG만 추가합니다.
         */
        initHistoryDetailUnifiedLayout();

        initGuestbookInfiniteScroll();

        /*
         * V6.18.109 · PERFORMANCE
         * ------------------------------------------------------------
         * Namecard는 개별 게시글에서만 존재할 수 있습니다.
         * 홈/한글화 목록/NEXT/프로젝트 히스토리 목록에서
         * document.body 전체 MutationObserver를 켜 둘 필요가 없으므로
         * 실제 tt-body-page에서만 시작합니다.
         *
         * 방명록은 위 FAST PATH가 기존 idle 방식으로 별도 처리합니다.
         */
        if (
          document.body &&
          document.body.id ===
          'tt-body-page'
        ) {
          initTistoryNamecardDecoration();
        }

        /*
         * V6.18.112:
         * 홈에서는 /글번호로 먼저 정상 이동하고,
         * 전달된 comment ID를 이용해 댓글 렌더 후 자동 스크롤합니다.
         */
        initTransferredCommentScroll();

        initBackToTop();
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startCalfSkin);
      } else {
        startCalfSkin();
      }
    })();
  