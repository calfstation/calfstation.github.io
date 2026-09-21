
    (function () {
      'use strict';

      const CALF_ROOT = 'https://calfstation.tistory.com';
      const BRAND_NAME = 'CALF STATION';
      const CREATOR_NAME = '꽃송아지';
      const HEADER_IMAGE =
        'https://tistory1.daumcdn.net/tistory/5722280/skin/images/CALF_STATION_header_scene_only.png';

      /* ================================================================
         A. 홈 카드 이미지
         ----------------------------------------------------------------
         ★ 이미지 교체는 아래 URL만 바꾸면 됩니다.
         ★ 카드 자체를 없애려면 HOME_CARD_CONFIG에서 해당 항목을 삭제하고
           renderHomeDashboard()의 순서도 함께 정리하면 됩니다.
         ================================================================ */
      const HOME_CARD_CONFIG = {
        patch: {
          image: 'https://tistory1.daumcdn.net/tistory/5722280/skin/images/calf-home-patch-art.png',
          imageAlt: '한글 문서를 읽는 8비트 쿠니오풍 캐릭터',
          kicker: 'PATCH ARCHIVE',
          title: '한글화',
          desc: '배포가 완료된 한글 패치를 최신순으로 확인합니다.',
          categoryUrl: window.CALF_PATCH_CATEGORY.activeUrlEncoded
        },
        next: {
          image: 'https://tistory1.daumcdn.net/tistory/5722280/skin/images/calf-home-next-art.png',
          imageAlt: '진행률 차트를 확인하는 8비트 쿠니오풍 캐릭터',
          kicker: 'IN PROGRESS',
          title: 'NEXT..?',
          desc: '현재 진행 중인 한글화 프로젝트의 평균 진행률입니다.',
          categoryUrl: '/category/NEXT'
        },
        history: {
          image: 'https://tistory1.daumcdn.net/tistory/5722280/skin/images/calf-home-history-art.png',
          imageAlt: '공사 작업복을 입고 삽질하는 8비트 쿠니오풍 캐릭터',
          kicker: 'PROJECT LOG',
          title: '히스토리',
          desc: '분석·번역·디버깅·검수 과정과 삽질을 남긴 작업 기록입니다.',
          categoryUrl: '/category/프로젝트%20히스토리'
        },
        secret: {
          image: 'https://tistory1.daumcdn.net/tistory/5722280/skin/images/calf-home-secretshop-art.png',
          imageAlt: '어두운 숲속 작은 전구가 켜진 8비트 비밀상점 오두막',
          kicker: 'SECRET SHOP',
          title: '비밀상점',
          desc: '아직 진열된 상품이 없습니다.',
          categoryUrl: ''
        }
      };

      /*
       * ================================================================
       * V6.18.107 · TODAY'S CALF / 오늘의 꽃송아지
       * ----------------------------------------------------------------
       * ★ 매일 할 일
       * Tistory 기본 글쓰기에서:
       *   카테고리 = 오늘의 꽃송아지
       *   제목     = 오늘의 한마디
       *   본문     = 비워도 됨
       *   공개     = 공개
       *
       * 날짜는 직접 적지 않습니다.
       * 게시일을 읽어 홈에서 MM.DD로 자동 표시합니다.
       *
       * ★ 직접 조절
       * HOME_DAILY_LOG_LIMIT = 홈에 보여 줄 최신 글 개수
       * 현재는 2개입니다.
       *
       * 이 카테고리 글은 홈에서 링크를 걸지 않으며,
       * SEO에서는 noindex,follow를 자동 적용합니다.
       * ================================================================ */
      const HOME_DAILY_LOG_CATEGORY_NAME =
        '오늘의 꽃송아지';

      const HOME_DAILY_LOG_CATEGORY_URL =
        '/category/%EC%98%A4%EB%8A%98%EC%9D%98%20%EA%BD%83%EC%86%A1%EC%95%84%EC%A7%80';

      const HOME_DAILY_LOG_LIMIT = 2;

      /*
       * ================================================================
       * V6.18.108 · 오늘의 열혈친구들
       * ----------------------------------------------------------------
       * HOME_FRIEND_COMMENT_LIMIT : 홈에 보여 줄 방문자 최신 댓글 수
       * OWNER_COMMENT_NAMES       : 홈 활동창에서 제외할 주인장 닉네임
       *
       * 실제 댓글/대댓글 기능 및 정렬에는 관여하지 않습니다.
       * ================================================================ */
      const HOME_FRIEND_COMMENT_LIMIT = 2;

      const OWNER_COMMENT_NAMES = [
        '꽃송아지'
      ];

      /*
       * ================================================================
       * V6.18.117 · SINGLE HOME FEED
       * ----------------------------------------------------------------
       * 방문자 HOME 대시보드 데이터는 GitHub Pages의 작은 JSON 1개만 읽습니다.
       * Tistory 카테고리/게시글 여러 개를 방문자 브라우저가 뒤에서 읽지 않습니다.
       * ================================================================ */
      const HOME_FEED_URL =
        'https://calfstation.github.io/home-feed.json';

      const HOME_FEED_CACHE_KEY =
        'calf-home-feed-v117';

      const HOME_FEED_CACHE_TTL =
        24 * 60 * 60 * 1000;


      /* ================================================================
         B. 기존 게시물 전용 SEO 별칭 FALLBACK
         ----------------------------------------------------------------
         ★ V6.18.74부터 새 글은 이 표를 수정하지 않습니다.

         - 과거 게시물(/6, /8, /17, /20 등)에 이미 넣어둔 별칭만
           호환용으로 남겨 둡니다.
         - CALF 글 생성기 V7.9가 만든 새 글은 .calf-patch-auto의
           data-seo-aliases / data-seo-title / data-seo-description을
           스킨이 자동으로 읽습니다.
         - 즉, 새 패치 게시물을 올릴 때 skin.html을 다시 열어
           SEO_ALIAS_MAP에 손으로 추가할 필요가 없습니다.
         ================================================================ */
      const SEO_ALIAS_MAP = {
        '/6': {
          aliases: ['열혈피구', '열혈고교 피구부'],
          short: '열혈피구 한글패치',
          seoTitle: '열혈피구 한글패치 | 열혈고교 피구부 | CALF STATION',
          description: '패미컴 열혈고교 피구부(열혈피구)의 한국어 한글패치입니다. 팀명·선수명·메뉴·타이틀을 한국어화하고 실제 게임 진행을 검수한 꽃송아지의 CALF STATION 배포 페이지입니다.'
        },
        '/8': {
          aliases: ['더블 드래곤 2', '더블 드래곤 II'],
          short: '더블 드래곤 2 한글패치',
          seoTitle: '더블 드래곤 2 한글패치 | 더 리벤지 | CALF STATION',
          description: '패미컴 더블 드래곤 II: 더 리벤지의 한국어 한글패치입니다. 타이틀·메뉴·미션 컷신·엔딩까지 한국어화한 꽃송아지의 CALF STATION 배포 페이지입니다.'
        },
        '/17': {
          aliases: ['열혈하키', '열혈하키부'],
          short: '열혈하키 한글패치',
          seoTitle: '열혈하키 한글패치 | 가라가라! 열혈하키부 | CALF STATION',
          description: '패미컴 가라가라! 열혈하키부(열혈하키)의 한국어 한글패치입니다. 본편·신문·팀명·선수명·HUD·엔딩을 한국어화한 꽃송아지의 CALF STATION 배포 페이지입니다.'
        },
        '/20': {
          aliases: ['열혈축구2', '열혈사커리그'],
          short: '열혈축구2 한글패치',
          seoTitle: '열혈축구2 한글패치 | 쿠니오군의 열혈축구리그 | CALF STATION',
          description: '국내에서 열혈축구2·열혈사커리그로도 불리는 패미컴 쿠니오군의 열혈축구리그 한국어 한글패치입니다. 메뉴·팀명·선수명·HUD·토너먼트·엔딩까지 검수한 CALF STATION 배포 페이지입니다.'
        },

        '/23': {
          aliases: ['열혈물어', '다운타운 열혈물어'],
          short: '열혈물어 한글화 제작기 PAGE2',
          seoTitle: '열혈물어 한글화 제작기 PAGE2 | 다운타운 열혈물어 | CALF STATION'
        },
        '/22': {
          aliases: ['열혈물어', '다운타운 열혈물어'],
          short: '열혈물어 한글화 제작기 PAGE1',
          seoTitle: '열혈물어 한글화 제작기 PAGE1 | 다운타운 열혈물어 | CALF STATION'
        },
        '/19': {
          aliases: ['열혈시대극', '다운타운 스페셜'],
          short: '열혈시대극 한글화 제작기 PAGE2',
          seoTitle: '열혈시대극 한글화 제작기 PAGE2 | 다운타운 스페셜 | CALF STATION'
        },
        '/18': {
          aliases: ['열혈축구2', '열혈사커리그'],
          short: '열혈축구2 한글화 제작기 PAGE2',
          seoTitle: '열혈축구2 한글화 제작기 PAGE2 | 쿠니오군의 열혈축구리그 | CALF STATION'
        },
        '/16': {
          aliases: ['열혈하키', '열혈하키부'],
          short: '열혈하키 한글화 제작기 PAGE2',
          seoTitle: '열혈하키 한글화 제작기 PAGE2 | 열혈하키부 | CALF STATION'
        },
        '/11': {
          aliases: ['캡틴 츠바사5', '캡틴 츠바사 V'],
          short: '캡틴 츠바사5 한글화 제작기',
          seoTitle: '캡틴 츠바사5 한글화 제작기 | 캡틴 츠바사 V | CALF STATION'
        },
        '/10': {
          aliases: ['열혈축구2', '열혈사커리그'],
          short: '열혈축구2 한글화 제작기 PAGE1',
          seoTitle: '열혈축구2 한글화 제작기 PAGE1 | 쿠니오군의 열혈축구리그 | CALF STATION'
        },
        '/9': {
          aliases: ['열혈하키', '열혈하키부'],
          short: '열혈하키 한글화 제작기 PAGE1',
          seoTitle: '열혈하키 한글화 제작기 PAGE1 | 열혈하키부 | CALF STATION'
        },
        '/7': {
          aliases: ['열혈시대극', '다운타운 스페셜'],
          short: '열혈시대극 한글화 제작기 PAGE1',
          seoTitle: '열혈시대극 한글화 제작기 PAGE1 | 다운타운 스페셜 | CALF STATION'
        }
      };

      const PATCH_CATEGORY_SEO = {
        title: '레트로게임 한글화·한글패치 모음 | CALF STATION',
        description: '꽃송아지가 제작·배포한 고전 콘솔·레트로게임 한글화·한국어화·한글 패치 모음입니다. 작품별 기종 정보와 검색 별칭은 각 게시물 SEO 데이터에서 자동 반영됩니다.'
      };

      const CATEGORY_SEO = {
        '/category/한글 패치': PATCH_CATEGORY_SEO,
        '/category/한글화': PATCH_CATEGORY_SEO,
        '/category/NEXT': {
          title: '진행 중 한글화 프로젝트 NEXT..? | CALF STATION',
          description: 'CALF STATION의 진행 중 레트로게임 한국어화 프로젝트입니다. 분석·한글화·검수 진행률과 현재 작업 상태를 확인할 수 있습니다.'
        },
        '/category/프로젝트 히스토리': {
          title: '한글화 작업기·프로젝트 히스토리 | CALF STATION',
          description: '꽃송아지의 레트로게임 한글화 작업 기록입니다. ROM 분석, 번역, 폰트, UI, 디버깅과 검수 과정을 프로젝트별로 정리합니다.'
        },

        /*
         * V6.18.106 · 비밀상점 카테고리 SEO
         * ------------------------------------------------------------
         * 아직 홈의 비밀상점 카드는 "준비 중" 상태를 유지합니다.
         * 나중에 Tistory에 실제 '비밀상점' 카테고리를 만든 순간부터
         * /category/비밀상점 주소에서 이 SEO가 자동 적용됩니다.
         */
        '/category/비밀상점': {
          title: '비밀상점 | CALF STATION',
          description: 'CALF STATION 비밀상점입니다. 꽃송아지가 소개하거나 기록하는 레트로게임 관련 소장품, 자료와 특별 콘텐츠를 모아봅니다.'
        },

        /*
         * V6.18.107 · 오늘의 꽃송아지 원본 보관 카테고리
         * 홈 로그의 데이터 공급원입니다.
         * 검색 결과에는 노출하지 않도록 applySeo()에서 noindex를 적용합니다.
         */
        '/category/오늘의 꽃송아지': {
          title: '오늘의 꽃송아지 | CALF STATION',
          description: 'CALF STATION 홈에 표시되는 꽃송아지의 짧은 일일 작업 로그 보관 페이지입니다.'
        }
      };

      function decodedPath() {
        let path = location.pathname || '/';
        try { path = decodeURIComponent(path); } catch (_) {}
        path = path.replace(/\/+$/, '') || '/';
        return path;
      }

      function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (m) {
          return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[m];
        });
      }

      function plainText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
      }

      function clampProgress(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return 0;
        return Math.max(0, Math.min(100, n));
      }

      function absolutePathFromHref(href) {
        try {
          const url = new URL(href || '', location.origin);
          return url.pathname.replace(/\/+$/, '') || '/';
        } catch (_) {
          return '';
        }
      }

      /* ================================================================
         V6.18.78 · 게시물별 플랫폼 SEO 자동 계층
         ----------------------------------------------------------------
         홈 화면에는 특정 기종을 나열하지 않습니다.
         대신 글 생성기/게시물의 data-platform 또는 data-platform-code를 읽어
         해당 글의 meta description / OG / Twitter / JSON-LD에만 자동 반영합니다.

         새 플랫폼을 추가하려면 SEO_PLATFORM_META에 한 줄을 추가하고
         normalizeSeoPlatformCode()의 별칭만 보강하면 됩니다.
         ================================================================ */
      const SEO_PLATFORM_META = {
        fc:  { label: '패미컴', short: 'FC', search: ['패미컴','FC','Famicom','NES'] },
        sfc: { label: '슈퍼패미컴', short: 'SFC', search: ['슈퍼패미컴','SFC','Super Famicom','SNES'] },
        md:  { label: '메가드라이브', short: 'MD', search: ['메가드라이브','MD','Mega Drive','Genesis'] },
        sms: { label: '세가 마스터 시스템', short: 'SMS', search: ['세가 마스터 시스템','SMS','Master System'] },
        pce: { label: 'PC엔진', short: 'PCE', search: ['PC엔진','PCE','PC Engine'] },
        gb:  { label: '게임보이', short: 'GB', search: ['게임보이','GB','Game Boy'] },
        gbc: { label: '게임보이 컬러', short: 'GBC', search: ['게임보이 컬러','GBC','Game Boy Color'] },
        gba: { label: '게임보이 어드밴스', short: 'GBA', search: ['게임보이 어드밴스','GBA','Game Boy Advance'] },
        nds: { label: '닌텐도 DS', short: 'NDS', search: ['닌텐도 DS','NDS','Nintendo DS'] },
        ps1: { label: '플레이스테이션', short: 'PS1', search: ['플레이스테이션','PS1','PlayStation'] }
      };

      function normalizeSeoPlatformCode(value) {
        const raw = plainText(value).toLowerCase();
        const compact = raw.replace(/[\s._\-/]+/g, '');
        if (!raw) return '';
        if (compact === 'fc' || compact === 'famicom' || raw.includes('패미컴') || raw.includes('family computer')) return 'fc';
        if (compact === 'sfc' || compact === 'snes' || compact === 'superfamicom' || raw.includes('슈퍼패미컴') || raw.includes('슈퍼 패미컴')) return 'sfc';
        if (compact === 'md' || compact === 'megadrive' || raw.includes('메가드라이브') || raw.includes('메가 드라이브')) return 'md';
        if (compact === 'sms' || raw.includes('마스터 시스템') || raw.includes('master system')) return 'sms';
        if (compact === 'pce' || compact === 'pcengine' || raw.includes('pc엔진') || raw.includes('pc 엔진')) return 'pce';
        if (compact === 'gbc' || raw.includes('게임보이 컬러')) return 'gbc';
        if (compact === 'gba' || raw.includes('게임보이 어드밴스')) return 'gba';
        if (compact === 'gb' || raw === '게임보이' || raw.includes('game boy')) return 'gb';
        if (compact === 'nds' || compact === 'ds' || raw.includes('닌텐도 ds')) return 'nds';
        if (compact === 'ps1' || compact === 'psx' || raw.includes('플레이스테이션')) return 'ps1';
        return '';
      }

      function seoPlatformFromNode(node) {
        if (!node) return null;
        const code = normalizeSeoPlatformCode(
          node.getAttribute('data-platform-code') ||
          node.getAttribute('data-platform') ||
          ''
        );
        return code && SEO_PLATFORM_META[code]
          ? Object.assign({ code: code }, SEO_PLATFORM_META[code])
          : null;
      }

      function currentArticlePlatform() {
        const node = document.querySelector(
          '.calf-patch-auto[data-platform-code], ' +
          '.calf-patch-auto[data-platform], ' +
          '.calf-next-project[data-platform]'
        );
        return seoPlatformFromNode(node);
      }

      function platformAwareDescription(description, platform, category) {
        let value = trimDescription(description || '');
        if (!platform || !window.calfIsPatchCategoryName(category)) return value;

        const already = platform.search.some(function (term) {
          return value.toLowerCase().includes(String(term).toLowerCase());
        });
        if (already) return value;

        return trimDescription(
          `${platform.label}(${platform.short})용 ${value}`
        );
      }

      /* ================================================================
         V6.18.75 · 글 생성기 V7.10 SEO/HOME CARD BRIDGE
         ----------------------------------------------------------------
         우선순위:
         1) 현재 게시물 안의 data-seo-*  ← 앞으로 새 글
         2) SEO_ALIAS_MAP                 ← 기존 글 호환
         3) 제목/본문 기반 자동 생성       ← 아무 설정도 없는 글

         이 데이터는 화면에 그리지 않습니다.
         title / meta description / JSON-LD에만 사용합니다.
         ================================================================ */
      function readEmbeddedSeoData() {
        const node = document.querySelector(
          '.calf-patch-auto[data-seo-source], '+
          '.calf-patch-auto[data-seo-aliases], '+
          '.calf-patch-auto[data-home-card-title], '+
          '.calf-seo-data[data-seo-aliases]'
        );

        if (!node) {
          return {
            aliases: [],
            seoTitle: '',
            description: '',
            homeCardTitle: '',
            source: '',
            platform: null
          };
        }

        const rawAliases =
          node.getAttribute('data-seo-aliases') || '';

        const seen = new Set();
        const aliases = rawAliases
          .split(/[|,，\n]+/)
          .map(function (value) { return plainText(value); })
          .filter(Boolean)
          .filter(function (value) {
            const key = value.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, 8);

        return {
          aliases: aliases,
          seoTitle: plainText(
            node.getAttribute('data-seo-title') || ''
          ),
          description: plainText(
            node.getAttribute('data-seo-description') || ''
          ),
          homeCardTitle: plainText(
            node.getAttribute('data-home-card-title') || ''
          ),
          source: plainText(
            node.getAttribute('data-seo-source') || ''
          ),
          platform: seoPlatformFromNode(node)
        };
      }


      async function fetchDocument(url) {
        const response = await fetch(url, {
          credentials: 'same-origin',
          cache: 'default',
          headers: { 'X-Requested-With': 'CALF-HOME-V75' }
        });
        if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + url);
        return new DOMParser().parseFromString(await response.text(), 'text/html');
      }

      function parsePostList(doc, limit) {
        return Array.from(
          doc.querySelectorAll('.list-card .post-list > .post-item > a[href]')
        ).slice(0, limit || 99).map(function (link) {
          const strong = link.querySelector('.post-text strong');
          const em = link.querySelector('.post-text em');
          const href = link.getAttribute('href') || '';
          return {
            url: new URL(href, location.origin).pathname,
            path: absolutePathFromHref(href),
            title: plainText(
              link.dataset.tiaraCopy ||
              link.dataset.tiaraName ||
              (strong ? strong.textContent : '')
            ),
            date: plainText(em ? em.textContent : '')
          };
        }).filter(function (post) {
          return post.url && post.title;
        });
      }


      /*
       * ================================================================
       * V6.18.108 · HOME ACTIVITY RENDER
       * ----------------------------------------------------------------
       * 왼쪽  : 오늘의 꽃송아지 최신 2개
       * 오른쪽: 오늘의 열혈친구들 방문자 최신 댓글 2개
       * ================================================================ */

      function homeDailyRelativeDate(value) {
        const text =
          plainText(value);

        if (!text) {
          return '';
        }

        /*
         * Tistory가 오늘 작성한 글을 HH:MM 또는 HH:MM:SS만 표시하는 경우.
         */
        if (
          /^\d{1,2}:\d{2}(?::\d{2})?$/.test(
            text
          )
        ) {
          return '오늘';
        }

        if (/방금|지금/.test(text)) {
          return '오늘';
        }

        if (
          /\d+\s*(초|분|시간)\s*전/.test(
            text
          )
        ) {
          return '오늘';
        }

        const relative =
          text.match(
            /(\d+)\s*(일|주|개월|년)\s*전/
          );

        if (relative) {
          return (
            relative[1] +
            relative[2] +
            ' 전'
          );
        }

        const absolute =
          text.match(
            /(\d{4})[.\-\/]\s*(\d{1,2})[.\-\/]\s*(\d{1,2})/
          );

        if (!absolute) {
          return text;
        }

        const posted =
          new Date(
            Number(absolute[1]),
            Number(absolute[2]) - 1,
            Number(absolute[3])
          );

        const now =
          new Date();

        const today =
          new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );

        const diffMs =
          today.getTime() -
          posted.getTime();

        if (
          !Number.isFinite(diffMs) ||
          diffMs <= 0
        ) {
          return '오늘';
        }

        const days =
          Math.floor(
            diffMs /
            (24 * 60 * 60 * 1000)
          );

        if (days <= 0) {
          return '오늘';
        }

        if (days < 7) {
          return days + '일 전';
        }

        if (days < 30) {
          return (
            Math.floor(days / 7) +
            '주 전'
          );
        }

        if (days < 365) {
          return (
            Math.floor(days / 30) +
            '개월 전'
          );
        }

        return (
          Math.floor(days / 365) +
          '년 전'
        );
      }


      function homeDailyLogRows(posts) {
        if (!posts.length) {
          return `
            <p class="calf-home-activity-empty">
              아직 오늘의 한마디가 없습니다.
            </p>`;
        }

        return `
          <ol class="calf-home-daily-list">
            ${posts.map(
              function (post, index) {
                const rank =
                  Math.min(
                    index,
                    HOME_DAILY_LOG_LIMIT - 1
                  );

                return `
                  <li
                    class="calf-home-daily-item is-rank-${rank}"
                    data-daily-log-rank="${rank}">
                    <time>
                      ${esc(
                        homeDailyRelativeDate(
                          post.date
                        )
                      )}
                    </time>

                    <span
                      title="${esc(post.title)}">
                      ${esc(post.title)}
                    </span>
                  </li>`;
              }
            ).join('')}
          </ol>`;
      }


      async function renderHomeDailyLog() {
        if (
          decodedPath() !== '/'
        ) {
          return;
        }

        const target =
          document.querySelector(
            '[data-home-daily-log]'
          );

        if (!target) {
          return;
        }

        try {
          const doc =
            await fetchDocument(
              HOME_DAILY_LOG_CATEGORY_URL
            );

          const posts =
            parsePostList(
              doc,
              HOME_DAILY_LOG_LIMIT
            );

          target.innerHTML =
            homeDailyLogRows(posts);
        } catch (err) {
          console.warn(
            '[CALF HOME] 오늘의 꽃송아지 load failed',
            err
          );

          target.innerHTML = `
            <p class="calf-home-activity-empty">
              오늘의 기록을 불러오지 못했습니다.
            </p>`;
        }
      }


      /*
       * Tistory <s_rctrp_rep>가 서버에서 렌더한 숨은 최근 댓글 소스를 읽습니다.
       * 홈에서는 링크를 사용하지 않고 닉네임/본문만 표시합니다.
       */
      function readHomeFriendComments() {
        const source =
          document.getElementById(
            'calf-recent-comments-source'
          );

        if (!source) {
          return [];
        }

        const owners =
          new Set(
            OWNER_COMMENT_NAMES.map(
              function (name) {
                return plainText(name);
              }
            )
          );

        return Array.from(
          source.querySelectorAll(
            '.calf-recent-comment-source-item'
          )
        )
          .map(function (item) {
            const nameNode =
              item.querySelector(
                '[data-rctrp-name]'
              );

            const descNode =
              item.querySelector(
                '[data-rctrp-desc]'
              );

            const timeNode =
              item.querySelector(
                '[data-rctrp-time]'
              );

            const linkNode =
              item.querySelector(
                '[data-rctrp-link]'
              );

            let link = '';

            if (linkNode) {
              try {
                const url =
                  new URL(
                    linkNode.getAttribute('href') || '',
                    location.origin
                  );

                /*
                 * 최근 댓글 링크는 같은 Tistory 블로그의 게시물/댓글 위치입니다.
                 * 외부 URL은 홈 활동창 링크로 사용하지 않습니다.
                 */
                if (
                  url.origin ===
                  location.origin
                ) {
                  link =
                    url.pathname +
                    url.search;
                }
              } catch (err) {}
            }

            return {
              name: plainText(
                nameNode
                  ? nameNode.textContent
                  : ''
              ),
              text: plainText(
                descNode
                  ? descNode.textContent
                  : ''
              ),
              link: link,
              commentId:
                linkNode
                  ? (
                      String(
                        linkNode.getAttribute(
                          'href'
                        ) || ''
                      ).match(
                        /#(comment\d+)$/i
                      ) || []
                    )[1] || ''
                  : '',
              kind: 'comment',
              time: parseHomeFriendTime(
                timeNode
                  ? timeNode.textContent
                  : ''
              ),
              _live: 1
            };
          })
          .filter(function (item) {
            return (
              item.name &&
              item.text &&
              !owners.has(item.name)
            );
          })
          .slice(
            0,
            HOME_FRIEND_COMMENT_LIMIT
          );
      }


      /*
       * ================================================================
       * V6.18.123 · HOME 열혈친구 실시간 댓글 우선 병합
       * ----------------------------------------------------------------
       * GitHub home-feed.json은 그대로 사용합니다.
       * 다만 GitHub schedule이 지연되더라도 현재 HOME HTML에 Tistory가
       * 이미 넣어 준 최신 댓글이 옛 feed에 의해 다시 덮어써지지 않도록,
       * 두 소스를 추가 요청 없이 병합하고 최신 2개만 표시합니다.
       *
       * - 기존 home-feed / NEXT / PATCH / HISTORY / 방명록 로직 변경 없음
       * - CSS 변경 없음
       * - 추가 fetch 없음
       * ================================================================
       */
      function parseHomeFriendTime(value) {
        const text =
          plainText(value || '');

        if (!text) {
          return 0;
        }

        const now = new Date();
        const nowMs = now.getTime();

        if (/방금|지금/.test(text)) {
          return nowMs / 1000;
        }

        let match =
          text.match(
            /(\d+)\s*(초|분|시간|일|주)\s*전/
          );

        if (match) {
          const amount =
            Number(match[1]) || 0;
          const seconds = {
            '초': 1,
            '분': 60,
            '시간': 3600,
            '일': 86400,
            '주': 604800
          }[match[2]] || 0;

          return (
            nowMs -
            amount * seconds * 1000
          ) / 1000;
        }

        function toTimestamp(
          year,
          month,
          day,
          hour,
          minute,
          ampm
        ) {
          let h = Number(hour) || 0;

          if (
            ampm === '오후' &&
            h < 12
          ) {
            h += 12;
          } else if (
            ampm === '오전' &&
            h === 12
          ) {
            h = 0;
          }

          const d = new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
            h,
            Number(minute) || 0,
            0,
            0
          );

          return Number.isNaN(
            d.getTime()
          )
            ? 0
            : d.getTime() / 1000;
        }

        /* 2026.08.28 / 2026-08-28 / 시간·오전오후 포함 */
        match = text.match(
          /(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})\.?(?:\s*(오전|오후)?\s*(\d{1,2}):(\d{2}))?/
        );

        if (match) {
          return toTimestamp(
            match[1],
            match[2],
            match[3],
            match[5] || 0,
            match[6] || 0,
            match[4] || ''
          );
        }

        /* 티스토리 연도 생략형: 08.28 / 08-28 12:34 */
        match = text.match(
          /(?:^|\s)(\d{1,2})\s*[.\-/]\s*(\d{1,2})\.?(?:\s*(오전|오후)?\s*(\d{1,2}):(\d{2}))?(?:$|\s)/
        );

        if (match) {
          let ts = toTimestamp(
            now.getFullYear(),
            match[1],
            match[2],
            match[4] || 0,
            match[5] || 0,
            match[3] || ''
          );

          if (
            ts &&
            ts * 1000 >
              nowMs + 86400000
          ) {
            ts = toTimestamp(
              now.getFullYear() - 1,
              match[1],
              match[2],
              match[4] || 0,
              match[5] || 0,
              match[3] || ''
            );
          }

          return ts;
        }

        /* 오늘 시간만: 12:34 / 오후 12:34 */
        match = text.match(
          /(?:^|\s)(오전|오후)?\s*(\d{1,2}):(\d{2})(?:$|\s)/
        );

        if (match) {
          let ts = toTimestamp(
            now.getFullYear(),
            now.getMonth() + 1,
            now.getDate(),
            match[2],
            match[3],
            match[1] || ''
          );

          if (
            ts &&
            ts * 1000 >
              nowMs + 300000
          ) {
            const yesterday =
              new Date(
                nowMs - 86400000
              );

            ts = toTimestamp(
              yesterday.getFullYear(),
              yesterday.getMonth() + 1,
              yesterday.getDate(),
              match[2],
              match[3],
              match[1] || ''
            );
          }

          return ts;
        }

        return 0;
      }


      function homeFriendIdentity(item) {
        if (!item) {
          return '';
        }

        if (item.commentId) {
          return (
            'comment:' +
            plainText(item.commentId)
          );
        }

        return [
          plainText(item.kind || ''),
          plainText(item.link || ''),
          plainText(item.name || ''),
          plainText(item.text || '')
        ].join('|');
      }


      function mergeHomeFriends(
        feedFriends,
        liveComments
      ) {
        const combined = [];
        const seen = new Set();
        let order = 0;

        function pushList(
          list,
          live
        ) {
          (Array.isArray(list)
            ? list
            : []
          ).forEach(function (raw) {
            if (
              !raw ||
              typeof raw !== 'object'
            ) {
              return;
            }

            const item =
              Object.assign(
                {},
                raw
              );

            item.name =
              plainText(
                item.name || ''
              );
            item.text =
              plainText(
                item.text || ''
              );
            item.link =
              plainText(
                item.link || ''
              );
            item.commentId =
              plainText(
                item.commentId || ''
              );
            item.kind =
              plainText(
                item.kind ||
                (live
                  ? 'comment'
                  : '')
              );
            item.time =
              Number(item.time) || 0;
            item._live =
              live ? 1 : 0;
            item._order =
              order++;

            if (
              !item.name ||
              !item.text
            ) {
              return;
            }

            const key =
              homeFriendIdentity(
                item
              );

            if (
              key &&
              seen.has(key)
            ) {
              return;
            }

            if (key) {
              seen.add(key);
            }

            combined.push(item);
          });
        }

        /*
         * 같은 댓글이 feed에도 있으면 현재 Tistory HTML 쪽을 먼저 채택합니다.
         */
        pushList(
          liveComments,
          true
        );
        pushList(
          feedFriends,
          false
        );

        combined.sort(
          function (a, b) {
            if (
              b.time !==
              a.time
            ) {
              return (
                b.time -
                a.time
              );
            }

            if (
              b._live !==
              a._live
            ) {
              return (
                b._live -
                a._live
              );
            }

            return (
              a._order -
              b._order
            );
          }
        );

        return combined.slice(
          0,
          HOME_FRIEND_COMMENT_LIMIT
        );
      }


      function homeFriendCommentRows(
        comments
      ) {
        if (!comments.length) {
          return `
            <p class="calf-home-activity-empty">
              아직 최근 열혈친구 댓글이 없습니다.
            </p>`;
        }

        return `
          <ol class="calf-home-friend-list">
            ${comments.map(
              function (comment, index) {
                const content = `
                  <strong
                    class="calf-home-friend-name"
                    title="${esc(comment.name)}">
                    ${esc(comment.name)}
                  </strong>

                  <span
                    class="calf-home-friend-marquee"
                    title="${esc(comment.text)}">
                    <span class="calf-home-friend-text">
                      ${esc(comment.text)}
                    </span>
                  </span>`;

                return `
                  <li
                    class="calf-home-friend-item is-rank-${index}">
                    ${
                      comment.link
                        ? `
                          <a
                            class="calf-home-friend-link"
                            href="${esc(comment.link)}"
                            ${
                              comment.commentId
                                ? `data-calf-target-comment="${esc(comment.commentId)}"`
                                : ''
                            }
                            aria-label="${esc(comment.name)}님의 ${
                              comment.kind === 'guestbook'
                                ? '방명록 글'
                                : '최근 댓글'
                            }로 이동">
                            ${content}
                          </a>`
                        : `
                          <span class="calf-home-friend-link is-no-link">
                            ${content}
                          </span>`
                    }
                  </li>`;
              }
            ).join('')}
          </ol>`;
      }



      /*
       * ================================================================
       * V6.18.109 · 오늘의 열혈친구들 AUTO TICKER
       * ----------------------------------------------------------------
       * 짧은 댓글:
       *   정지.
       *
       * 박스 폭을 넘는 댓글:
       *   1) 처음 잠시 정지
       *   2) 우→좌로 천천히 이동
       *   3) 마지막 문장이 보인 상태로 잠시 정지
       *   4) 다시 처음부터 반복
       *
       * 마우스 hover / 키보드 focus:
       *   애니메이션 일시정지.
       *
       * prefers-reduced-motion:
       *   자동 이동 없음.
       *
       * JS는 최초 렌더 + resize 때 "넘치는지"만 측정하고,
       * 실제 반복 이동은 CSS transform 애니메이션이 담당합니다.
       * ================================================================ */

      function refreshHomeFriendTickers() {
        const root =
          document.querySelector(
            '[data-home-friend-comments]'
          );

        if (!root) {
          return;
        }

        const reduced =
          window.matchMedia &&
          window.matchMedia(
            '(prefers-reduced-motion: reduce)'
          ).matches;

        root.querySelectorAll(
          '.calf-home-friend-marquee'
        ).forEach(function (viewport) {
          const text =
            viewport.querySelector(
              '.calf-home-friend-text'
            );

          if (!text) {
            return;
          }

          text.classList.remove(
            'is-ticker'
          );

          text.style.removeProperty(
            '--calf-friend-ticker-distance'
          );

          text.style.removeProperty(
            '--calf-friend-ticker-duration'
          );

          if (reduced) {
            return;
          }

          /*
           * layout이 정착된 뒤 실제 넘치는 픽셀만 계산.
           */
          const distance =
            Math.ceil(
              text.scrollWidth -
              viewport.clientWidth
            );

          if (distance <= 3) {
            return;
          }

          /*
           * 기본 약 24px/s.
           * 짧은 overflow도 너무 빠르지 않게 최소 7.5초,
           * 매우 긴 댓글도 20초를 넘지 않게 제한.
           */
          const duration =
            Math.max(
              7.5,
              Math.min(
                20,
                (distance / 24) + 3.2
              )
            );

          text.style.setProperty(
            '--calf-friend-ticker-distance',
            distance + 'px'
          );

          text.style.setProperty(
            '--calf-friend-ticker-duration',
            duration.toFixed(2) + 's'
          );

          text.classList.add(
            'is-ticker'
          );
        });
      }


      function initHomeFriendTickers() {
        const root =
          document.querySelector(
            '[data-home-friend-comments]'
          );

        if (!root) {
          return;
        }

        window.requestAnimationFrame(
          function () {
            window.requestAnimationFrame(
              refreshHomeFriendTickers
            );
          }
        );

        if (
          root.dataset
            .calfFriendTickerResize ===
          '1'
        ) {
          return;
        }

        root.dataset
          .calfFriendTickerResize =
          '1';

        let timer = 0;

        window.addEventListener(
          'resize',
          function () {
            window.clearTimeout(
              timer
            );

            timer =
              window.setTimeout(
                refreshHomeFriendTickers,
                140
              );
          },
          {
            passive: true
          }
        );
      }



      /*
       * ================================================================
       * V6.18.113 · HOME IIFE LOCAL COMMENT TRANSFER BRIDGE
       * ----------------------------------------------------------------
       * 중요:
       * renderHomeFriendComments()는 이 HOME/SEO IIFE 안에서 실행됩니다.
       *
       * V112의 실수:
       * 다른 IIFE에 들어 있는 initHomeFriendCommentTransferLinks()를
       * 여기서 직접 호출해 ReferenceError가 발생했습니다.
       *
       * 이번에는 같은 IIFE 안에서 클릭 이벤트를 연결합니다.
       * 저장 키는 메인 IIFE의 initTransferredCommentScroll()이 읽는 것과
       * 동일한 'calf-home-comment-target-v1' 입니다.
       * ================================================================ */

      function initHomeFriendCommentTransferLinksLocal() {
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

            const pagePath =
              link.getAttribute(
                'href'
              ) || '';

            const commentId =
              link.dataset
                .calfTargetComment || '';

            if (
              !pagePath ||
              !/^comment\d+$/i.test(
                commentId
              )
            ) {
              return;
            }

            try {
              sessionStorage.setItem(
                'calf-home-comment-target-v1',
                JSON.stringify({
                  path: pagePath,
                  commentId: commentId,
                  savedAt: Date.now()
                })
              );
            } catch (err) {}

            /*
             * preventDefault 하지 않습니다.
             * href=/글번호 로 브라우저가 정상 이동합니다.
             */
          }
        );
      }


      function renderHomeFriendComments() {
        if (
          decodedPath() !== '/'
        ) {
          return;
        }

        const target =
          document.querySelector(
            '[data-home-friend-comments]'
          );

        if (!target) {
          return;
        }

        target.innerHTML =
          homeFriendCommentRows(
            readHomeFriendComments()
          );

        initHomeFriendTickers();

        /*
         * V6.18.113:
         * 반드시 HOME/SEO IIFE 내부 로컬 브리지를 호출합니다.
         * 여기서 오류가 나면 아래 홈 카드 fetch 자체가 시작되지 않기 때문에
         * IIFE 경계 밖 함수를 호출하지 않습니다.
         */
        initHomeFriendCommentTransferLinksLocal();
      }


      function homeCardHeader(config) {
        return `
          <div class="calf-home-card-head">
            <span class="calf-home-card-kicker">${esc(config.kicker)}</span>
            <h2 class="calf-home-card-title">${esc(config.title)}</h2>
          </div>
          <p class="calf-home-card-desc">${esc(config.desc)}</p>`;
      }

      function homeCardFigure(config) {
        return `
          <figure class="calf-home-card-figure">
            <img
              src="${esc(config.image)}"
              alt="${esc(config.imageAlt)}"
              width="640"
              height="360"
              loading="eager"
              decoding="async">
          </figure>`;
      }

      /* ================================================================
         V6.18.75 · 홈 카드 2줄 목록
         ----------------------------------------------------------------
         한글패치:
           1줄 = V7.10 홈 카드 표시명 / 기존 글 short fallback
           2줄 = 실제 티스토리 게시물 제목

         프로젝트 히스토리:
           1줄 = 실제 게시물 제목
           2줄 = 제목 + PAGE를 분석한 자동 부제목

         프로젝트 히스토리는 티스토리 기본 에디터만 사용하면 됩니다.
         ================================================================ */
      function patchFallbackDisplayTitle(post) {
        const legacy=SEO_ALIAS_MAP[post.path]||{};
        if(legacy.short)return legacy.short;
        const first=legacy.aliases&&legacy.aliases.length?legacy.aliases[0]:'';
        if(first)return /한글\s*패치/i.test(first)?first:first+' 한글패치';
        return post.title;
      }

      async function enrichPatchHomePost(post) {
        const legacy=SEO_ALIAS_MAP[post.path]||{};
        if(legacy.short){
          return Object.assign({},post,{displayTitle:legacy.short,subtitle:post.title});
        }
        try{
          const doc=await fetchDocument(post.url);
          const node=doc.querySelector('.calf-patch-auto[data-home-card-title], .calf-patch-auto[data-seo-source]');
          const saved=node?plainText(node.getAttribute('data-home-card-title')||''):'';
          const raw=node?plainText(node.getAttribute('data-seo-aliases')||''):'';
          const first=raw.split(/[|,，\n]+/).map(function(v){return plainText(v);}).filter(Boolean)[0]||'';
          const auto=first?(/한글\s*패치/i.test(first)?first:first+' 한글패치'):post.title;
          return Object.assign({},post,{displayTitle:saved||auto,subtitle:post.title});
        }catch(err){
          console.warn('[CALF HOME] patch display title load failed',post.url,err);
          return Object.assign({},post,{displayTitle:patchFallbackDisplayTitle(post),subtitle:post.title});
        }
      }

      function historyProjectBaseTitle(title) {
        const text=plainText(title);
        if(/다운타운\s*열혈물어|열혈물어/.test(text))return '열혈물어 한글화 작업기';
        if(/열혈시대극|다운타운\s*스페셜/.test(text))return '열혈시대극 한글화 작업기';
        if(/열혈축구리그|열혈축구2|열혈사커리그/.test(text))return '열혈축구2 한글화 작업기';
        if(/열혈하키|열혈하키부/.test(text))return '열혈하키 한글화 작업기';
        if(/캡틴\s*츠바사\s*(?:V|5)/i.test(text))return '캡틴 츠바사 V 한글화 작업기';
        const cleaned=text.replace(/\s*히스토리\s*/gi,' ').replace(/\s*-?\s*PAGE\s*\d+.*$/i,'').replace(/\s*\(END\)\s*/gi,' ').replace(/\s+/g,' ').trim();
        return (cleaned||'프로젝트')+' 한글화 작업기';
      }

      function historySubtitle(title) {
        const text=plainText(title);
        const match=text.match(/PAGE\s*(\d+)/i);
        const page=match?Number(match[1]):0;
        const base=historyProjectBaseTitle(text);
        return page>0?base+' '+page:base;
      }

      function enrichHistoryHomePost(post) {
        return Object.assign({},post,{displayTitle:post.title,subtitle:historySubtitle(post.title)});
      }

      /*
       * ================================================================
       * V6.18.106 · 기본 티스토리 에디터 전용 AUTO SEO LAYER
       * ----------------------------------------------------------------
       * 대상 카테고리:
       *   1) 프로젝트 히스토리
       *   2) 비밀상점
       *
       * ★ 게시글 작성 방법
       * ------------------------------------------------------------
       * 프로젝트 히스토리/비밀상점은 앞으로도 Tistory 기본 에디터에서
       * 제목 + 본문 + 이미지만 작성하고 카테고리만 선택하면 됩니다.
       *
       * HTML 모드로 바꾸거나 아래 속성을 수동 입력할 필요가 없습니다.
       *   data-seo-title
       *   data-seo-description
       *   data-seo-aliases
       *
       * 우선순위:
       *   게시물 data-seo-* 수동 override   ← 있으면 최우선
       *   이 AUTO SEO LAYER                ← 기본 에디터 글
       *   SEO_ALIAS_MAP                    ← 과거 글 호환 안전망
       *
       * 즉 기존 프로젝트 히스토리의 /7 /9 /10 /11 /16 /18 /19 /22 /23
       * 수동 fallback 항목을 삭제하지 않아도,
       * 실제 카테고리가 '프로젝트 히스토리'이면 자동 SEO가 우선 적용됩니다.
       * ================================================================ */

      const AUTO_EDITOR_SEO = {
        history: {
          category: '프로젝트 히스토리',

          /*
           * JSON-LD keywords 전용.
           * 화면 본문에는 이 문구를 삽입하지 않습니다.
           */
          keywords: [
            '프로젝트 히스토리',
            '한글화 작업기',
            '한글화 제작기',
            'ROM 분석',
            '번역',
            'UI',
            '디버깅',
            '검수'
          ]
        },

        secret: {
          category: '비밀상점',
          keywords: [
            '비밀상점',
            'SECRET SHOP',
            '레트로게임',
            '고전게임',
            'CALF STATION'
          ]
        }
      };


      /*
       * 프로젝트 히스토리 작품별 검색 별칭 자동 추출.
       *
       * 새 프로젝트가 아래 규칙에 없더라도 SEO는 정상 생성됩니다.
       * 그 경우 게시글 제목 자체 + "한글화 작업기"를 사용합니다.
       *
       * 새 작품의 국내 별칭까지 자동 검색어에 넣고 싶을 때만
       * 이 함수에 if 한 줄을 추가하면 됩니다.
       */
      function historyAutoSeoAliases(title) {
        const text =
          plainText(title);

        if (
          /다운타운\s*열혈물어|열혈물어/.test(text)
        ) {
          return [
            '열혈물어',
            '다운타운 열혈물어'
          ];
        }

        if (
          /열혈시대극|다운타운\s*스페셜/.test(text)
        ) {
          return [
            '열혈시대극',
            '다운타운 스페셜'
          ];
        }

        if (
          /열혈축구리그|열혈축구2|열혈사커리그/.test(text)
        ) {
          return [
            '열혈축구2',
            '열혈축구리그',
            '열혈사커리그'
          ];
        }

        if (
          /열혈하키|열혈하키부/.test(text)
        ) {
          return [
            '열혈하키',
            '열혈하키부'
          ];
        }

        if (
          /캡틴\s*츠바사\s*(?:V|5)/i.test(text)
        ) {
          return [
            '캡틴 츠바사 V',
            '캡틴 츠바사5'
          ];
        }

        return [];
      }


      /*
       * 첫 문단을 아직 읽을 수 없거나 너무 짧아도 description이 비지 않도록
       * 카테고리 성격에 맞는 기본 설명을 제공합니다.
       */
      function autoEditorFallbackDescription(
        category,
        autoTitle
      ) {
        if (
          category ===
          AUTO_EDITOR_SEO.history.category
        ) {
          return (
            `${autoTitle}입니다. ` +
            'ROM 분석, 번역, 폰트, UI 수정, 디버깅과 검수 과정에서 확인한 내용을 기록합니다.'
          );
        }

        if (
          category ===
          AUTO_EDITOR_SEO.secret.category
        ) {
          return (
            `${autoTitle}에 관한 CALF STATION 비밀상점 글입니다. ` +
            '꽃송아지가 소개하거나 기록하는 레트로게임 관련 소장품, 자료와 특별 콘텐츠를 정리합니다.'
          );
        }

        return '';
      }


      /*
       * 프로젝트 히스토리/비밀상점 개별 글의 자동 SEO 데이터를 만듭니다.
       *
       * firstArticleText()는 실제 본문에서 첫 의미 있는 문단을 읽고,
       * articleImage()는 실제 본문의 첫 이미지를 OG/Twitter/JSON-LD 대표 이미지로 사용합니다.
       */
      function buildAutoEditorSeo(
        title,
        category
      ) {
        const rawTitle =
          plainText(title);

        if (
          category ===
          AUTO_EDITOR_SEO.history.category
        ) {
          const autoTitle =
            historySubtitle(rawTitle);

          const aliases =
            historyAutoSeoAliases(rawTitle);

          const firstText =
            firstArticleText();

          const description =
            trimDescription(
              firstText
                ? (
                    `${autoTitle}. ` +
                    firstText
                  )
                : autoEditorFallbackDescription(
                    category,
                    autoTitle
                  )
            );

          return {
            aliases: aliases,
            seoTitle:
              `${autoTitle} | ${BRAND_NAME}`,
            description: description,
            source:
              'AUTO-EDITOR-SEO-HISTORY',
            keywords:
              AUTO_EDITOR_SEO.history.keywords
          };
        }

        if (
          category ===
          AUTO_EDITOR_SEO.secret.category
        ) {
          const autoTitle =
            rawTitle ||
            '비밀상점';

          const firstText =
            firstArticleText();

          const description =
            trimDescription(
              firstText
                ? (
                    `${autoTitle}. ` +
                    firstText
                  )
                : autoEditorFallbackDescription(
                    category,
                    autoTitle
                  )
            );

          return {
            aliases: [
              '비밀상점',
              'SECRET SHOP'
            ],
            seoTitle:
              `${autoTitle} | 비밀상점 | ${BRAND_NAME}`,
            description: description,
            source:
              'AUTO-EDITOR-SEO-SECRET',
            keywords:
              AUTO_EDITOR_SEO.secret.keywords
          };
        }

        return {
          aliases: [],
          seoTitle: '',
          description: '',
          source: '',
          keywords: []
        };
      }


      function homePostRows(posts,type) {
        if(!posts.length)return '<p class="calf-home-card-empty">표시할 게시물이 없습니다.</p>';
        return '<ul class="calf-home-mini-list">'+posts.map(function(post){
          const alias=SEO_ALIAS_MAP[post.path];
          const aliasText=alias&&alias.aliases?alias.aliases.join(', '):'';
          const assistiveTitle=aliasText?post.title+' · 검색 별칭: '+aliasText:post.title;
          const firstLine=post.displayTitle||post.title;
          const secondLine=post.subtitle||'';
          return `
            <li>
              <a href="${esc(post.url)}" title="${esc(assistiveTitle)}" aria-label="${esc(assistiveTitle)}">
                <span class="calf-home-mini-copy">
                  <strong>${esc(firstLine)}</strong>
                  ${secondLine?`<small>${esc(secondLine)}</small>`:''}
                </span>
                <time>${esc(post.date)}</time>
              </a>
            </li>`;
        }).join('')+'</ul>';
      }

      async function readNextProgress(post) {
        try {
          const doc = await fetchDocument(post.url);
          const block = doc.querySelector('.calf-next-project');
          if (!block) return null;

          const analysis = clampProgress(block.dataset.analysis);
          const translation = clampProgress(block.dataset.translation);
          const review = clampProgress(
            block.dataset.review || block.dataset.verification || 0
          );
          const average = Math.round((analysis + translation + review) / 3);
          const title = plainText(block.dataset.projectTitle || post.title);

          return Object.assign({}, post, {
            title: title,
            average: average
          });
        } catch (err) {
          console.warn('[CALF HOME] NEXT progress load failed', post.url, err);
          return null;
        }
      }

      function homeProgressRows(projects) {
        const valid = projects.filter(Boolean);
        if (!valid.length) {
          return '<p class="calf-home-card-empty">진행률 정보를 불러오는 중입니다.</p>';
        }

        return '<div class="calf-home-progress-list">' + valid.map(function (project) {
          return `
            <div class="calf-home-progress-item">
              <span class="calf-home-progress-title" title="${esc(project.title)}">
                ${esc(project.title)}
              </span>
              <span class="calf-home-progress-line">
                <span class="calf-home-progress-track" aria-hidden="true">
                  <span class="calf-home-progress-fill" style="width:${project.average}%"></span>
                </span>
                <strong>${project.average}%</strong>
              </span>
            </div>`;
        }).join('') + '</div>';
      }

      function renderHomeSkeleton(card) {
        card.className = 'calf-home-landing';
        card.innerHTML = `
          <header class="calf-home-landing-intro">
            <!--
              ============================================================
              V6.18.108 · HOME ACTIVITY 2열
              ------------------------------------------------------------
              왼쪽  : TODAY'S CALF / 오늘의 꽃송아지
              오른쪽: HOT-BLOODED FRIENDS / 오늘의 열혈친구들
              ============================================================
            -->
            <div class="calf-home-activity-grid">

              <section
                class="calf-home-activity-card calf-home-daily-log"
                aria-label="오늘의 꽃송아지 최근 작업 로그">
                <div class="calf-home-activity-head">
                  <span class="calf-home-activity-kicker">
                    TODAY'S CALF
                  </span>

                  <strong>
                    오늘의 꽃송아지
                  </strong>
                </div>

                <div
                  class="calf-home-activity-body"
                  data-home-daily-log
                  aria-live="polite">
                </div>
              </section>

              <section
                class="calf-home-activity-card calf-home-friend-log"
                aria-label="오늘의 열혈친구들 최근 댓글">
                <div class="calf-home-activity-head">
                  <span class="calf-home-activity-kicker">
                    HOT-BLOODED FRIENDS
                  </span>

                  <strong>
                    오늘의 열혈친구들
                  </strong>
                </div>

                <div
                  class="calf-home-activity-body"
                  data-home-friend-comments>
                </div>
              </section>

            </div>

            <div class="calf-home-archive-line">
              <h1>
                레트로게임 한글화 · 한글 패치 아카이브
              </h1>

              <span
                class="calf-home-archive-separator"
                aria-hidden="true">
              </span>

              <p>
                <strong>꽃송아지</strong>의 고전 콘솔·레트로게임 한글화·한글 패치,
                배포와 제작 기록을 한눈에♥
              </p>
            </div>
          </header>

          <div class="calf-home-card-grid">
            <section class="calf-home-menu-card is-patch" data-home-card="patch">
              ${homeCardFigure(HOME_CARD_CONFIG.patch)}
              <div class="calf-home-card-body">
                ${homeCardHeader(HOME_CARD_CONFIG.patch)}
                <div class="calf-home-card-dynamic" data-home-dynamic="patch">
                  <p class="calf-home-card-loading">최신 패치를 불러오는 중...</p>
                </div>
                <a class="calf-home-card-more" href="${HOME_CARD_CONFIG.patch.categoryUrl}">
                  전체 한글화 보기 →
                </a>
              </div>
            </section>

            <section class="calf-home-menu-card is-next" data-home-card="next">
              ${homeCardFigure(HOME_CARD_CONFIG.next)}
              <div class="calf-home-card-body">
                ${homeCardHeader(HOME_CARD_CONFIG.next)}
                <div class="calf-home-card-dynamic" data-home-dynamic="next">
                  <p class="calf-home-card-loading">프로젝트 진행률을 계산하는 중...</p>
                </div>
                <a class="calf-home-card-more" href="${HOME_CARD_CONFIG.next.categoryUrl}">
                  프로젝트 진행 현황 목록 →
                </a>
              </div>
            </section>

            <section class="calf-home-menu-card is-history" data-home-card="history">
              ${homeCardFigure(HOME_CARD_CONFIG.history)}
              <div class="calf-home-card-body">
                ${homeCardHeader(HOME_CARD_CONFIG.history)}
                <div class="calf-home-card-dynamic" data-home-dynamic="history">
                  <p class="calf-home-card-loading">최근 작업기를 불러오는 중...</p>
                </div>
                <a class="calf-home-card-more" href="${HOME_CARD_CONFIG.history.categoryUrl}">
                  전체 프로젝트 히스토리 보기 →
                </a>
              </div>
            </section>

            <section class="calf-home-menu-card is-secret" data-home-card="secret">
              ${homeCardFigure(HOME_CARD_CONFIG.secret)}
              <div class="calf-home-card-body">
                ${homeCardHeader(HOME_CARD_CONFIG.secret)}
                <div class="calf-home-secret-state">
                  <strong>준비 중</strong>
                  <span>조금만 기다려 주세요!</span>
                </div>
              </div>
            </section>
          </div>`;
      }

      /*
       * ================================================================
       * V6.18.117 · HOME FEED SNAPSHOT
       * ----------------------------------------------------------------
       * 재방문:
       *   localStorage의 마지막 정상 feed를 즉시 그린 뒤 JSON 1회 갱신.
       *
       * 첫 방문:
       *   작은 home-feed.json 1회만 받아 전체 대시보드를 그립니다.
       * ================================================================ */

      function normalizeHomeFeed(feed) {
        if (
          !feed ||
          typeof feed !== 'object'
        ) {
          return null;
        }

        return {
          generatedAt:
            plainText(
              feed.generatedAt || ''
            ),

          daily:
            Array.isArray(feed.daily)
              ? feed.daily.slice(
                  0,
                  HOME_DAILY_LOG_LIMIT
                )
              : [],

          friends:
            Array.isArray(feed.friends)
              ? feed.friends.slice(
                  0,
                  HOME_FRIEND_COMMENT_LIMIT
                )
              : [],

          patch:
            Array.isArray(feed.patch)
              ? feed.patch.slice(0, 3)
              : [],

          next:
            Array.isArray(feed.next)
              ? feed.next.slice(0, 3)
              : [],

          history:
            Array.isArray(feed.history)
              ? feed.history.slice(0, 3)
              : []
        };
      }


      function readHomeFeedSnapshot() {
        try {
          const raw =
            localStorage.getItem(
              HOME_FEED_CACHE_KEY
            );

          if (!raw) {
            return null;
          }

          const saved =
            JSON.parse(raw);

          if (
            !saved ||
            !Number.isFinite(
              saved.savedAt
            ) ||
            Date.now() -
              saved.savedAt >
              HOME_FEED_CACHE_TTL
          ) {
            localStorage.removeItem(
              HOME_FEED_CACHE_KEY
            );

            return null;
          }

          return normalizeHomeFeed(
            saved.feed
          );
        } catch (err) {
          return null;
        }
      }


      function writeHomeFeedSnapshot(
        feed
      ) {
        try {
          localStorage.setItem(
            HOME_FEED_CACHE_KEY,
            JSON.stringify({
              savedAt:
                Date.now(),
              feed:
                feed
            })
          );
        } catch (err) {}
      }


      function renderHomeFeed(
        feed
      ) {
        const normalized =
          normalizeHomeFeed(
            feed
          );

        if (!normalized) {
          return false;
        }

        const dailyTarget =
          document.querySelector(
            '[data-home-daily-log]'
          );

        const friendTarget =
          document.querySelector(
            '[data-home-friend-comments]'
          );

        const patchTarget =
          document.querySelector(
            '[data-home-dynamic="patch"]'
          );

        const nextTarget =
          document.querySelector(
            '[data-home-dynamic="next"]'
          );

        const historyTarget =
          document.querySelector(
            '[data-home-dynamic="history"]'
          );

        if (dailyTarget) {
          dailyTarget.innerHTML =
            homeDailyLogRows(
              normalized.daily
            );
        }

        if (friendTarget) {
          friendTarget.innerHTML =
            homeFriendCommentRows(
              mergeHomeFriends(
                normalized.friends,
                readHomeFriendComments()
              )
            );

          initHomeFriendTickers();
          initHomeFriendCommentTransferLinksLocal();
        }

        if (patchTarget) {
          patchTarget.innerHTML =
            homePostRows(
              normalized.patch,
              'patch'
            );
        }

        if (nextTarget) {
          nextTarget.innerHTML =
            homeProgressRows(
              normalized.next
            );
        }

        if (historyTarget) {
          historyTarget.innerHTML =
            homePostRows(
              normalized.history,
              'history'
            );
        }

        return true;
      }


      async function fetchHomeFeedOnce() {
        const response =
          await fetch(
            HOME_FEED_URL,
            {
              method: 'GET',
              mode: 'cors',
              credentials: 'omit',
              cache: 'no-cache'
            }
          );

        if (!response.ok) {
          throw new Error(
            'HOME FEED HTTP ' +
            response.status
          );
        }

        const feed =
          await response.json();

        /*
         * V6.18.122
         * 화면 렌더링은 renderHomeFeed()가 알아서 3개로 잘라 쓰지만,
         * localStorage에는 raw feed 전체를 저장해야 NEXT 카테고리의
         * 4번째/5번째 이후 프로젝트도 즉시 복원할 수 있습니다.
         */
        if (!normalizeHomeFeed(feed)) {
          throw new Error(
            'HOME FEED INVALID'
          );
        }

        return feed;
      }


      async function renderHomeDashboard() {
        if (
          decodedPath() !== '/'
        ) {
          return;
        }

        const listCard =
          document.querySelector(
            '.list-card'
          );

        if (!listCard) {
          document.documentElement
            .classList.remove(
              'calf-home-booting'
            );

          return;
        }

        renderHomeSkeleton(
          listCard
        );

        const paging =
          document.getElementById(
            'paging'
          );

        if (paging) {
          paging.style.display =
            'none';
        }

        /*
         * 재방문은 네트워크보다 먼저 직전 정상 대시보드가 즉시 보입니다.
         */
        const snapshot =
          readHomeFeedSnapshot();

        if (snapshot) {
          renderHomeFeed(
            snapshot
          );
        }

        try {
          /*
           * ★ HOME 데이터 추가 네트워크 요청은 이 1회뿐입니다.
           */
          const feed =
            await fetchHomeFeedOnce();

          renderHomeFeed(
            feed
          );

          writeHomeFeedSnapshot(
            feed
          );
        } catch (err) {
          console.warn(
            '[CALF HOME] single feed load failed',
            err
          );

          /*
           * snapshot이 있으면 그대로 유지.
           * 첫 방문 + feed 실패일 때만 각 영역에 간단한 실패 안내를 표시합니다.
           */
          if (!snapshot) {
            const dailyTarget =
              document.querySelector(
                '[data-home-daily-log]'
              );

            const friendTarget =
              document.querySelector(
                '[data-home-friend-comments]'
              );

            const patchTarget =
              document.querySelector(
                '[data-home-dynamic="patch"]'
              );

            const nextTarget =
              document.querySelector(
                '[data-home-dynamic="next"]'
              );

            const historyTarget =
              document.querySelector(
                '[data-home-dynamic="history"]'
              );

            if (dailyTarget) {
              dailyTarget.innerHTML =
                '<p class="calf-home-activity-empty">오늘의 기록을 불러오지 못했습니다.</p>';
            }

            if (friendTarget) {
              /*
               * Tistory 홈 HTML에 이미 들어 있는 서버 최근댓글을 마지막 안전망으로 사용.
               * 추가 네트워크 요청은 없습니다.
               */
              friendTarget.innerHTML =
                homeFriendCommentRows(
                  readHomeFriendComments()
                );

              initHomeFriendTickers();
              initHomeFriendCommentTransferLinksLocal();
            }

            [patchTarget, nextTarget, historyTarget]
              .forEach(function (target) {
                if (!target) return;

                target.innerHTML =
                  '<p class="calf-home-card-loading">목록을 불러오지 못했습니다.</p>';
              });
          }
        } finally {
          document.documentElement
            .classList.remove(
              'calf-home-booting'
            );
        }
      }


      /* ================================================================
         C. SEO 메타 태그/JSON-LD 자동화
         ================================================================ */
      function setMetaByName(name, content) {
        if (!content) return;
        const selector = 'meta[name="' + name + '"]';
        let meta = document.head.querySelector(selector);
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', name);
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
        Array.from(document.head.querySelectorAll(selector)).slice(1).forEach(function (dup) {
          dup.remove();
        });
      }

      function setMetaByProperty(property, content) {
        if (!content) return;
        const selector = 'meta[property="' + property + '"]';
        let meta = document.head.querySelector(selector);
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('property', property);
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
        Array.from(document.head.querySelectorAll(selector)).slice(1).forEach(function (dup) {
          dup.remove();
        });
      }

      function ensureCanonical() {
        let canonical = document.head.querySelector('link[rel="canonical"]');
        if (!canonical) {
          canonical = document.createElement('link');
          canonical.rel = 'canonical';
          document.head.appendChild(canonical);
        }
        canonical.href = location.origin + decodedPath();
      }

      function pageMainTitle() {
        const node =
          document.querySelector('.entry-title a') ||
          document.querySelector('.entry-title') ||
          document.querySelector('.list-card .page-title') ||
          document.querySelector('.page-title');
        return plainText(node ? node.textContent : document.title);
      }

      function pageCategory() {
        const article = document.querySelector('.entry-card[data-calf-category]');
        if (article) {
          const value = plainText(article.getAttribute('data-calf-category'));
          if (value) return value;
        }
        const meta = document.querySelector('.entry-card .meta');
        const text = plainText(meta ? meta.textContent : '');
        const match = text.match(/카테고리\s*:\s*(.*?)\s*(?:\||$)/);
        return match && match[1] ? plainText(match[1]) : '';
      }

      function firstArticleText() {
        const article = document.querySelector('#article-view, .entry-card .content.article');
        if (!article) return '';

        const clone = article.cloneNode(true);
        clone.querySelectorAll('script,style,iframe,figure,table,.calf-patch-auto,.calf-next-project').forEach(function (node) {
          node.remove();
        });

        const paragraphs = Array.from(clone.querySelectorAll('p,li'));
        const selected = paragraphs.map(function (p) {
          return plainText(p.textContent);
        }).find(function (text) {
          return text.length >= 30;
        });

        return selected || plainText(clone.textContent).slice(0, 240);
      }

      function trimDescription(text) {
        let value = plainText(text);
        if (value.length > 165) value = value.slice(0, 162).replace(/[\s,.;:!?]+$/, '') + '...';
        return value;
      }

      function buildGenericDescription(title, category, aliases) {
        const base = firstArticleText();
        const aliasPart = aliases && aliases.length
          ? ' (' + aliases.join('·') + ')' : '';

        if (window.calfIsPatchCategoryName(category)) {
          return trimDescription(
            `${title}${aliasPart}의 한국어 한글패치 배포 페이지입니다. ${base || '꽃송아지가 제작·검수한 패치 정보와 적용 내용을 CALF STATION에 정리했습니다.'}`
          );
        }

        if (category === '프로젝트 히스토리') {
          return trimDescription(
            `${title}${aliasPart}의 한글화 작업 기록입니다. ${base || 'ROM 분석, 번역, 폰트, UI, 디버깅과 검수 과정을 꽃송아지가 기록합니다.'}`
          );
        }

        if (category === '비밀상점') {
          return trimDescription(
            `${title}${aliasPart}에 관한 CALF STATION 비밀상점 글입니다. ${base || '꽃송아지가 소개하거나 기록하는 레트로게임 관련 소장품, 자료와 특별 콘텐츠를 정리합니다.'}`
          );
        }

        return trimDescription(base || `${title} - ${BRAND_NAME}`);
      }

      function articleImage() {
        const img = document.querySelector(
          '#article-view img[src], .entry-card .content.article img[src], .calf-patch-cover img[src]'
        );
        if (!img) return HEADER_IMAGE;
        try { return new URL(img.getAttribute('src'), location.href).href; }
        catch (_) { return HEADER_IMAGE; }
      }

      function parsePublishedDate() {
        const meta = plainText((document.querySelector('.entry-card .meta') || {}).textContent || '');
        const m = meta.match(/작성일\s*:\s*(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?(?:\s*(\d{1,2}):(\d{2}))?/);
        if (!m) return '';
        const y=m[1], mo=String(m[2]).padStart(2,'0'), d=String(m[3]).padStart(2,'0');
        const hh=String(m[4] || '00').padStart(2,'0'), mm=String(m[5] || '00').padStart(2,'0');
        return `${y}-${mo}-${d}T${hh}:${mm}:00+09:00`;
      }

      function addJsonLd(data, id) {
        const old = document.getElementById(id);
        if (old) old.remove();
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = id;
        script.dataset.calfSeoJsonld = '1';
        script.textContent = JSON.stringify(data);
        document.head.appendChild(script);
      }

      function applyInternalAliasAnchors() {
        document.querySelectorAll(
          '.post-item > a[href], .recent-grid a[href]'
        ).forEach(function (link) {
          const path = absolutePathFromHref(link.getAttribute('href'));
          const info = SEO_ALIAS_MAP[path];
          if (!info || !info.aliases || link.dataset.calfSeoAliasDone === '1') {
            return;
          }

          const titleNode = link.querySelector(
            '.post-text strong, .recent-title'
          );
          if (!titleNode) return;

          const original = plainText(titleNode.textContent);
          if (!original) return;

          const assistive = original + ' · 검색 별칭: ' + info.aliases.join(', ');
          titleNode.setAttribute('title', assistive);
          titleNode.setAttribute('aria-label', assistive);
          link.setAttribute('title', assistive);
          link.setAttribute('aria-label', assistive);
          link.dataset.calfSeoAliasDone = '1';
        });
      }

      function applySeo() {
        const path = decodedPath();

        /*
         * V6.18.74:
         * 새 글은 게시물 속 data-seo-*를 최우선으로 사용하고,
         * 기존 글만 SEO_ALIAS_MAP을 fallback으로 사용합니다.
         */
        const fallback = SEO_ALIAS_MAP[path] || {};
        const embedded = readEmbeddedSeoData();

        const categoryInfo = CATEGORY_SEO[path] || null;
        const title = pageMainTitle();
        const category = pageCategory();

        /*
         * V6.18.107 · 오늘의 꽃송아지 원본 페이지 SEO 정책
         * ------------------------------------------------------------
         * 게시물은 홈 로그의 데이터 공급원으로 공개 상태여야 하지만,
         * 검색 결과에 별도 콘텐츠 페이지로 노출할 필요는 없습니다.
         *
         * - 카테고리 페이지: noindex,follow
         * - 그 카테고리의 개별 글: noindex,follow
         * - 홈에서 원본 글 링크는 노출하지 않음
         */
        const isDailyLogSeoPage =
          path ===
            '/category/오늘의 꽃송아지' ||
          category ===
            HOME_DAILY_LOG_CATEGORY_NAME;

        if (isDailyLogSeoPage) {
          setMetaByName(
            'robots',
            'noindex,follow'
          );

          setMetaByName(
            'googlebot',
            'noindex,follow'
          );
        }

        /*
         * V6.18.106:
         * 프로젝트 히스토리/비밀상점은 기본 Tistory 에디터만 사용해도
         * 카테고리 + 제목 + 본문을 읽어 SEO 데이터를 자동 생성합니다.
         */
        const autoEditor =
          buildAutoEditorSeo(
            title,
            category
          );

        /*
         * SEO 우선순위
         * ------------------------------------------------------------
         * 1) data-seo-*             : 필요할 때 수동 override
         * 2) AUTO EDITOR SEO        : 프로젝트 히스토리 / 비밀상점
         * 3) SEO_ALIAS_MAP          : 과거 게시물 호환
         *
         * 한글화 배포글은 기존 V7.10 data-seo-* 정책 그대로입니다.
         */
        const specific = {
          aliases: embedded.aliases.length
            ? embedded.aliases
            : (
                autoEditor.aliases.length
                  ? autoEditor.aliases
                  : (fallback.aliases || [])
              ),
          short: fallback.short || '',
          seoTitle:
            embedded.seoTitle ||
            autoEditor.seoTitle ||
            fallback.seoTitle ||
            '',
          description:
            embedded.description ||
            autoEditor.description ||
            fallback.description ||
            '',
          homeCardTitle:
            embedded.homeCardTitle ||
            fallback.short ||
            '',
          source:
            embedded.source ||
            autoEditor.source ||
            (
              fallback.seoTitle
                ? 'LEGACY-SEO-ALIAS-MAP'
                : ''
            ),
          autoKeywords:
            autoEditor.keywords || []
        };

        const platform =
          embedded.platform ||
          currentArticlePlatform();

        let seoTitle = '';
        let description = '';

        if (path === '/') {
          seoTitle = 'CALF STATION | 꽃송아지의 레트로게임 한글패치·한글화 프로젝트';
          description = '꽃송아지의 고전 콘솔·레트로게임 한글화·한국어화·한글 패치, 배포와 제작 기록을 한눈에 모은 CALF STATION입니다.';
        } else if (categoryInfo) {
          seoTitle = categoryInfo.title;
          description = categoryInfo.description;
        } else {
          seoTitle = specific.seoTitle || (title ? `${title} | ${BRAND_NAME}` : BRAND_NAME);
          description = specific.description || buildGenericDescription(
            title,
            category,
            specific.aliases || []
          );
          description = platformAwareDescription(
            description,
            platform,
            category
          );
        }

        document.title = seoTitle;
        setMetaByName('title', seoTitle);
        setMetaByName('description', description);
        setMetaByName('author', `${CREATOR_NAME} · ${BRAND_NAME}`);
        setMetaByName('twitter:card', 'summary_large_image');
        setMetaByName('twitter:title', seoTitle);
        setMetaByName('twitter:description', description);

        setMetaByProperty('og:title', seoTitle);
        setMetaByProperty('og:description', description);
        setMetaByProperty('og:site_name', BRAND_NAME);
        setMetaByProperty('og:locale', 'ko_KR');
        setMetaByProperty('og:url', location.origin + path);
        setMetaByProperty('og:type', document.querySelector('.entry-card') ? 'article' : 'website');
        setMetaByProperty('og:image', articleImage());
        ensureCanonical();

        if (path === '/') {
          addJsonLd({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: BRAND_NAME,
            alternateName: ['칼프 스테이션', 'calfstation.tistory.com'],
            url: CALF_ROOT + '/'
          }, 'calf-seo-website-jsonld');
        }

        const article = document.querySelector('.entry-card');

        /*
         * 오늘의 꽃송아지 원본은 noindex용 데이터 보관 글이므로
         * 별도의 BlogPosting 구조화 데이터도 만들지 않습니다.
         */
        if (
          article &&
          title &&
          !isDailyLogSeoPage
        ) {
          const published = parsePublishedDate();
          const schema = {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: title,
            description: description,
            inLanguage: 'ko-KR',
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': location.origin + path
            },
            image: [articleImage()],
            articleSection: category || 'CALF STATION',
            author: {
              '@type': 'Person',
              name: CREATOR_NAME,
              url: CALF_ROOT + '/'
            },
            publisher: {
              '@type': 'Organization',
              name: BRAND_NAME,
              url: CALF_ROOT + '/'
            },
            isPartOf: {
              '@type': 'WebSite',
              name: BRAND_NAME,
              url: CALF_ROOT + '/'
            }
          };

          /* 진단용: 검색 결과 화면에는 표시되지 않습니다. */
          if (specific.source) {
            schema.encodingFormat = 'text/html';
          }

          if (published) schema.datePublished = published;

          if (platform) {
            schema.about = {
              '@type': 'VideoGame',
              name: title,
              gamePlatform: platform.label
            };
          }

          /*
           * V6.18.106 · 카테고리별 JSON-LD keywords
           * ------------------------------------------------------------
           * 화면에는 보이지 않는 구조화 데이터입니다.
           *
           * - 한글화 배포글: 기존 한글화/한글패치 검색어
           * - 프로젝트 히스토리: 작업기/ROM분석/번역/디버깅/검수
           * - 비밀상점: 비밀상점/SECRET SHOP/레트로게임
           * - 기타 글: 강제 키워드 없음
           */
          const categoryKeywords =
            window.calfIsPatchCategoryName(category)
              ? window.CALF_PATCH_CATEGORY.searchTerms
              : (
                  specific.autoKeywords &&
                  specific.autoKeywords.length
                    ? specific.autoKeywords
                    : []
                );

          const schemaKeywords = []
            .concat(
              specific.aliases || []
            )
            .concat(
              categoryKeywords,
              platform
                ? platform.search
                : [],
              [
                BRAND_NAME,
                CREATOR_NAME
              ]
            )
            .filter(Boolean);

          if (specific.aliases && specific.aliases.length) {
            schema.alternativeHeadline = specific.aliases.join(' · ');
          }

          if (schemaKeywords.length) {
            schema.keywords = Array.from(new Set(schemaKeywords)).join(', ');
          }

          addJsonLd(schema, 'calf-seo-blogposting-jsonld');
        }

        applyInternalAliasAnchors();
        window.setTimeout(applyInternalAliasAnchors, 1200);
        window.setTimeout(applyInternalAliasAnchors, 2800);
      }

      function init() {
        applySeo();
        renderHomeDashboard();
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
      } else {
        init();
      }
    })();
  