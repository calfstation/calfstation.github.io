
    (function () {
      const CONTENT_ID = 'calf-content-start';
      const STORAGE_KEY = 'calf-nav-scroll-target-v1';
      const reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      function contentTarget() {
        return document.getElementById(CONTENT_ID);
      }

      function stickyOffset() {
        const value = getComputedStyle(document.documentElement)
          .getPropertyValue('--calf-sticky-nav-height')
          .trim();
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 52;
      }

      /*
        자동 스크롤:
        고정 리모컨 높이만큼 위쪽 여백을 남겨 콘텐츠 제목이 메뉴 뒤에 가리지 않게 합니다.
      */
      function scrollToContent(behavior) {
        const target = contentTarget();
        if (!target) return;

        const top = Math.max(
          0,
          target.getBoundingClientRect().top + window.scrollY - stickyOffset() - 10
        );

        window.scrollTo({
          top: top,
          behavior: behavior
        });
      }

      function smoothToContent() {
        scrollToContent(reduceMotion ? 'auto' : 'smooth');
      }

      function jumpToContent() {
        scrollToContent('auto');
      }

      function quickSmoothToContent() {
        const target = contentTarget();
        if (!target) return;

        const destination = Math.max(
          0,
          target.getBoundingClientRect().top + window.scrollY - stickyOffset() - 10
        );

        if (reduceMotion) {
          window.scrollTo(0, destination);
          return;
        }

        const start = window.scrollY || window.pageYOffset || 0;
        const distance = destination - start;

        if (Math.abs(distance) < 2) return;

        const started = performance.now();
        const duration = 170;

        function frame(now) {
          const progress = Math.min(1, (now - started) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          window.scrollTo(0, start + distance * eased);

          if (progress < 1) {
            window.requestAnimationFrame(frame);
          }
        }

        window.requestAnimationFrame(frame);
      }

      function normalizedPath(url) {
        return (url.pathname.replace(/\/+$/, '') || '/');
      }

      /*
       * PERF2 · 메뉴 INTENT PREFETCH
       * ------------------------------------------------------------
       * 메뉴에 실제 접근 의도가 생겼을 때 해당 문서만 prefetch합니다.
       * 다른 페이지의 JavaScript까지 미리 실행하는 prerender는 사용하지 않습니다.
       */
      const speculatedNavTargets = new Set();

      function isFastCategoryTarget(pathname) {
        let path = pathname;
        try { path = decodeURIComponent(path); } catch (_) {}

        return (
          /^\/guestbook\/?$/i.test(path) ||
          /^\/category\/NEXT\/?$/i.test(path) ||
          /^\/category\/프로젝트 히스토리\/?$/i.test(path) ||
          window.calfIsPatchCategoryPath(path)
        );
      }

      function speculateNavTarget(link) {
        if (!link) return;

        let url;
        try {
          url = new URL(link.href, location.href);
        } catch (_) {
          return;
        }

        if (url.origin !== location.origin) return;
        url.hash = '';

        const target = url.pathname + url.search;
        const current = location.pathname + location.search;

        if (target === current || speculatedNavTargets.has(target)) return;
        speculatedNavTargets.add(target);

        /*
         * PERF2:
         * 다른 Tistory 문서를 통째로 실행하는 prerender는 사용하지 않습니다.
         * 메뉴 전환 예열은 HTML 문서 prefetch까지만 수행합니다.
         */
        const hint = document.createElement('link');
        hint.rel = 'prefetch';
        hint.href = target;
        hint.as = 'document';
        document.head.appendChild(hint);
      }

      function handleNavIntent(event) {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const link = target.closest('.fc-nav a.nav-btn');
        if (!link) return;
        speculateNavTarget(link);
      }

      document.addEventListener('pointerover', handleNavIntent, { passive: true });
      document.addEventListener('focusin', handleNavIntent, { passive: true });
      document.addEventListener('touchstart', handleNavIntent, { passive: true });


      /*
       * V6.18.121 · 전역 IDLE WARMUP 제거
       * 한글화/NEXT/히스토리를 무조건 뒤에서 읽지 않습니다.
       * 현재 페이지 자원을 비워 두고, 방명록 하나만 전용 prerender합니다.
       */

      /*
        헤더 메뉴가 화면 위로 사라진 뒤에는 같은 버튼을 복제한 고정 리모컨을 표시합니다.
        원본 메뉴가 다시 보이면 고정 리모컨은 자동으로 숨습니다.

        V6.18.53:
        - 한글 패치 목록뿐 아니라 /20 같은 한글 패치 상세 게시글에서도
          쿠니오+리키 애니메이션이 동일하게 작동합니다.
        - 방명록은 확정된 하키 청소부 NO-FLIP WebP를 유지합니다.
        - NEXT / 프로젝트 히스토리도 목록/상세를 공통 판별할 수 있도록 준비했습니다.
        - 애니메이션은 원래 헤더 메뉴가 아니라 "상단 고정 리모컨"에만 존재합니다.
      */
      function setupStickyRemote() {
        const sourceNav = document.querySelector('.fc-header > .fc-nav');
        if (!sourceNav) return;

        const shell = document.createElement('div');
        shell.className = 'calf-sticky-nav-shell';
        shell.setAttribute('aria-hidden', 'true');

        const STICKY_ANIM_ROOT =
          'https://tistory1.daumcdn.net/tistory/5722280/skin/images/';

        function normalizeCategoryName(value) {
          return String(value || '').replace(/\s+/g, ' ').trim();
        }

        function getCurrentPageContext() {
          let decodedPath = normalizedPath(new URL(location.href));
          try { decodedPath = decodeURIComponent(decodedPath); } catch (_) {}

          if (decodedPath === '/') return { type:'home', category:'', path:decodedPath };
          if (decodedPath === '/guestbook' || decodedPath.indexOf('/guestbook/') === 0) {
            return { type:'guestbook', category:'', path:decodedPath };
          }
          if (window.calfIsPatchCategoryPath(decodedPath)) {
            return {
              type:'patch',
              category:window.CALF_PATCH_CATEGORY.displayName,
              path:decodedPath
            };
          }
          if (decodedPath === '/category/NEXT' || decodedPath.indexOf('/category/NEXT/') === 0) {
            return { type:'next', category:'NEXT', path:decodedPath };
          }
          if (decodedPath === '/category/프로젝트 히스토리' || decodedPath.indexOf('/category/프로젝트 히스토리/') === 0) {
            return { type:'history', category:'프로젝트 히스토리', path:decodedPath };
          }

          const article = document.querySelector('.entry-card[data-calf-category]');
          let articleCategory = normalizeCategoryName(
            article ? article.getAttribute('data-calf-category') : ''
          );

          if (!articleCategory) {
            const meta = document.querySelector('.entry-card .meta');
            if (meta) {
              const match = normalizeCategoryName(meta.textContent).match(
                /카테고리\s*:\s*(.*?)\s*(?:\||$)/
              );
              if (match && match[1]) articleCategory = normalizeCategoryName(match[1]);
            }
          }

          if (window.calfIsPatchCategoryName(articleCategory)) return { type:'patch', category:articleCategory, path:decodedPath };
          if (articleCategory === 'NEXT') return { type:'next', category:articleCategory, path:decodedPath };
          if (articleCategory === '프로젝트 히스토리') return { type:'history', category:articleCategory, path:decodedPath };
          return { type:'other', category:articleCategory, path:decodedPath };
        }

        const pageContext = getCurrentPageContext();
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        function cssNumber(name, fallback) {
          const raw = getComputedStyle(document.documentElement)
            .getPropertyValue(name).trim();
          const value = parseFloat(raw);
          return Number.isFinite(value) ? value : fallback;
        }

        /* ============================================================
           V6.18.73 · V6.18.71 FINAL CLEAN ANIMATION MAP 원형 복원/봉인
           ------------------------------------------------------------
           이 블록은 V6.18.71 애니메이션 동작을 그대로 유지합니다.
           홈        : 열혈 두더지
           한글패치  : 익사이트 바이크 / 두더지 50:50
           NEXT      : 쿠니오+리키 / 두더지 50:50
           히스토리  : 자동차 청소기 / 두더지 50:50
           방명록    : 하키 빗자루 청소부 / 두더지 50:50

           중요:
           - V6.18.73의 단순 프레임 루프/사인파 두더지 코드는 폐기.
           - 신규 홈 대시보드/SEO와 이 애니메이션 블록은 서로 독립입니다.
           ============================================================ */

        const STICKY_RUNNER_DATA = {"car":{"file":"calf-runner-cleaner-car.png","frameCount":192,"cols":12,"cellW":70,"cellH":54,"durations":[1500,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,370],"anchors":[2.5,6.0,8.0,10.0,12.0,14.0,16.0,18.0,20.0,22.0,25.0,27.0,30.0,32.0,34.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,34.0,35.0,33.0,30.0,28.0,26.0,23.0,21.0,18.0,16.0,14.0,11.0,9.0,8.0,6.0,4.0,3.0,3.0,2.5],"path":[0.0,0.0,0.00287,0.00573,0.0086,0.01146,0.01433,0.01719,0.02006,0.02292,0.02436,0.02722,0.02865,0.03152,0.03438,0.04011,0.04441,0.05158,0.05587,0.06304,0.06734,0.0745,0.0788,0.08596,0.09026,0.09742,0.10172,0.10888,0.11318,0.12034,0.12464,0.13181,0.1361,0.14327,0.14756,0.15473,0.15903,0.16619,0.17049,0.17765,0.18195,0.18911,0.19341,0.20057,0.20487,0.21203,0.21633,0.2235,0.22779,0.23496,0.23926,0.24642,0.25072,0.25788,0.26218,0.26934,0.27364,0.2808,0.2851,0.29226,0.29656,0.30372,0.30802,0.31519,0.31948,0.32665,0.33095,0.33811,0.34241,0.34957,0.35387,0.36103,0.36533,0.37249,0.37679,0.38395,0.38825,0.39542,0.39971,0.40688,0.41117,0.41834,0.42264,0.4298,0.4341,0.44126,0.44556,0.45272,0.45702,0.46418,0.46848,0.47564,0.47994,0.48711,0.4914,0.49857,0.50287,0.51003,0.51433,0.52149,0.52579,0.53295,0.53725,0.54441,0.54871,0.55587,0.56017,0.56734,0.57163,0.5788,0.58309,0.59026,0.59456,0.60172,0.60602,0.61318,0.61748,0.62464,0.62894,0.6361,0.6404,0.64756,0.65186,0.65903,0.66332,0.67049,0.67479,0.68195,0.68625,0.69341,0.69771,0.70487,0.70917,0.71633,0.72063,0.72779,0.73209,0.73926,0.74355,0.75072,0.75501,0.76218,0.76648,0.77364,0.77794,0.7851,0.7894,0.79656,0.80086,0.80802,0.81232,0.81948,0.82378,0.83095,0.83524,0.84241,0.8467,0.85387,0.85817,0.86533,0.86963,0.87679,0.88109,0.88825,0.89255,0.89971,0.90401,0.91117,0.91547,0.92264,0.92693,0.9341,0.9384,0.94556,0.94986,0.95702,0.96132,0.96418,0.96705,0.97135,0.97421,0.97851,0.98138,0.98424,0.98854,0.9914,0.99284,0.9957,0.99857,1.0,1.0,1.0],"totalMs":15170},"broom":{"file":"calf-runner-broom.png","frameCount":133,"cols":11,"cellW":45,"cellH":38,"durations":[130,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,60,390],"anchors":[2.5,3.0,6.0,4.0,6.0,11.0,16.0,18.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,16.0,24.0,13.0,15.0,14.0,22.0,9.0,5.0,2.5,5.0,2.5],"path":[0.0,0.0,0.00487,0.00162,0.00487,0.01299,0.0211,0.02435,0.03247,0.04383,0.05357,0.05682,0.06494,0.0763,0.08604,0.08929,0.0974,0.10877,0.11851,0.12175,0.12987,0.14123,0.15097,0.15422,0.16234,0.1737,0.18344,0.18669,0.19481,0.20617,0.21591,0.21916,0.22727,0.23864,0.24838,0.25162,0.25974,0.2711,0.28084,0.28409,0.29221,0.30357,0.31331,0.31656,0.32468,0.33604,0.34578,0.34903,0.35714,0.36851,0.37825,0.38149,0.38961,0.40097,0.41071,0.41396,0.42208,0.43344,0.44318,0.44643,0.45455,0.46591,0.47565,0.4789,0.48701,0.49838,0.50812,0.51136,0.51948,0.53084,0.54058,0.54383,0.55195,0.56331,0.57305,0.5763,0.58442,0.59578,0.60552,0.60877,0.61688,0.62825,0.63799,0.64123,0.64935,0.66071,0.67045,0.6737,0.68182,0.69318,0.70292,0.70617,0.71429,0.72565,0.73539,0.73864,0.74675,0.75812,0.76786,0.7711,0.77922,0.79058,0.80032,0.80357,0.81169,0.82305,0.83279,0.83604,0.84416,0.85552,0.86526,0.86851,0.87662,0.88799,0.89773,0.90097,0.90909,0.92045,0.93019,0.93344,0.94156,0.95292,0.96266,0.96591,0.97403,0.98539,0.99188,0.99513,1.0,1.0,1.0,1.0,1.0],"totalMs":8380}};

        const EXCITE_ATLAS_DATA = {
          file: 'calf-runner-excitebike-atlas-v2.png',
          cols: 8,
          cellW: 30,
          cellH: 30,
          map: {
            '0':0,'1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,
            '8':8,'9':9,'10':10,'11':11,'12':12,'13':13,'14':14,'15':15,
            '16':16,'17':17,'18':18,'19':19,'20':20,'21':21,'22':22,'23':23,
            '24':24,'25':25,'26':26,'27':27,'28':28,'29':29,'30':30,
            '35':31,'36':32,'38':33,'39':34,'40':35,'42':36
          }
        };

        const MOLE_FACE_DATA = {
          file: 'calf-nekketsu-mole-heads-64.png',
          count: 64,
          cols: 8,
          cellW: 108,
          cellH: 60
        };

        const MOLE_PRESET = {
          kind: 'mole-heads',
          name: 'nekketsu-moles',
          randomWeight: 1,
          widthMode: 'screen',
          screenInsetLeftPx: 18,
          screenInsetRightPx: 18,
          extendLeftPx: 120,
          extendRightPx: 120,
          faceHeight: 35,
          slotPitch: 76,
          minSlots: 10,
          maxSlots: 22,
          visibleMin: 7,
          visibleMax: 12,
          riseMinMs: 210,
          riseMaxMs: 340,
          holdMinMs: 520,
          holdMaxMs: 1050,
          fallMinMs: 210,
          fallMaxMs: 340,
          waitMinMs: 160,
          waitMaxMs: 820
        };

        const EXCITE_PRESET = {
          kind: 'excitebike',
          name: 'excitebike-story',
          randomWeight: 1,
          timeScale: 1.00,
          spriteScale: 1.80,
          rideBobPx: 1.35,
          rideBobHz: 7.0,
          cycleSec: 12.50,
          staffAppearSec: 7.00,
          flagDownSec: 8.55,
          staffExitSec: 11.05,
          staffExitDurationSec: 0.95
        };

        const KUNIO_RIKI_PRESET = {
          kind: 'kunio-runner',
          name: 'kunio-riki',
          randomWeight: 1
        };

        const CAR_PRESET = {
          kind: 'sheet',
          name: 'cleaner-car',
          data: 'car',
          randomWeight: 1,
          height: 42,
          timeScale: 1.00,
          direction: 'rtl',
          reverseFramesOnReturn: false,
          startOffsetMs: 1500
        };

        const BROOM_PRESET = {
          kind: 'sheet',
          name: 'broom',
          data: 'broom',
          randomWeight: 1,
          height: 36,
          timeScale: 2.00,
          direction: 'pingpong',
          reverseFramesOnReturn: false,
          startOffsetMs: 0
        };

        const STICKY_SCENE_CONFIG = {
          home: [
            { ...MOLE_PRESET }
          ],
          patch: [
            { ...EXCITE_PRESET },
            { ...MOLE_PRESET }
          ],
          next: [
            { ...KUNIO_RIKI_PRESET },
            { ...MOLE_PRESET }
          ],
          history: [
            { ...CAR_PRESET },
            { ...MOLE_PRESET }
          ],
          guestbook: [
            { ...BROOM_PRESET },
            { ...MOLE_PRESET }
          ]
        };

        function pickRandomScene(list) {
          if (!Array.isArray(list) || !list.length) return null;
          if (list.length === 1) return list[0];

          const total = list.reduce(function (sum, item) {
            return sum + Math.max(0, Number(item.randomWeight) || 0);
          }, 0);

          if (total <= 0) {
            return list[Math.floor(Math.random() * list.length)];
          }

          let roll = Math.random() * total;
          for (const item of list) {
            roll -= Math.max(0, Number(item.randomWeight) || 0);
            if (roll <= 0) return item;
          }
          return list[list.length - 1];
        }

        const selectedScene = pickRandomScene(
          STICKY_SCENE_CONFIG[pageContext.type] || []
        );

        let sceneController = null;

        /* --------------------------------------------------------------
           A. V71 열혈 얼굴 두더지
           rise → hold → fall → wait 상태 머신을 그대로 사용합니다.
           -------------------------------------------------------------- */
        if (selectedScene && selectedScene.kind === 'mole-heads') {
          const scene = document.createElement('div');
          scene.className =
            'calf-sticky-scene is-mole-heads is-' + pageContext.type;
          scene.setAttribute('aria-hidden', 'true');

          const canvas = document.createElement('canvas');
          canvas.className = 'calf-sticky-special-canvas';
          scene.appendChild(canvas);
          shell.appendChild(scene);

          const ctx = canvas.getContext('2d', { alpha: true });
          if (ctx) {
            ctx.imageSmoothingEnabled = false;

            const faceSheet = new Image();
            faceSheet.decoding = 'async';
            faceSheet.dataset.src =
              STICKY_ANIM_ROOT + MOLE_FACE_DATA.file;

            let loaded = false;
            let running = false;
            let started = false;
            let lastTime = performance.now();
            let slots = [];
            let lastSlotCount = 0;
            let faceBag = [];

            function randomBetween(minValue, maxValue) {
              return minValue + Math.random() * (maxValue - minValue);
            }

            function clampNumber(minValue, value, maxValue) {
              return Math.max(minValue, Math.min(maxValue, value));
            }

            function refillFaceBag() {
              faceBag = Array.from(
                { length: MOLE_FACE_DATA.count },
                (_, index) => index
              );

              for (let i = faceBag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [faceBag[i], faceBag[j]] = [faceBag[j], faceBag[i]];
              }
            }

            function nextFace() {
              if (!faceBag.length) refillFaceBag();
              return faceBag.pop();
            }

            function measureMoleTrack() {
              const sceneRect = scene.getBoundingClientRect();

              if (selectedScene.widthMode === 'screen') {
                const insetLeft = Math.max(
                  0,
                  Number(selectedScene.screenInsetLeftPx) || 0
                );
                const insetRight = Math.max(
                  0,
                  Number(selectedScene.screenInsetRightPx) || 0
                );

                return {
                  left: Math.min(scene.clientWidth, insetLeft),
                  right: Math.max(
                    insetLeft + 1,
                    scene.clientWidth - insetRight
                  )
                };
              }

              if (selectedScene.widthMode === 'buttons') {
                const buttons = shell.querySelectorAll('.fc-nav .nav-btn');

                if (buttons.length >= 2) {
                  const first = buttons[0].getBoundingClientRect();
                  const last = buttons[buttons.length - 1].getBoundingClientRect();
                  const padding = cssNumber('--calf-mole-track-padding', 0);
                  const extendLeft = Math.max(
                    0,
                    Number(selectedScene.extendLeftPx) || 0
                  );
                  const extendRight = Math.max(
                    0,
                    Number(selectedScene.extendRightPx) || 0
                  );

                  return {
                    left: Math.max(
                      0,
                      first.left - sceneRect.left + padding - extendLeft
                    ),
                    right: Math.min(
                      scene.clientWidth,
                      last.right - sceneRect.left - padding + extendRight
                    )
                  };
                }
              }

              return { left: 0, right: scene.clientWidth };
            }

            function resetSlot(slot, now, immediate) {
              /*
               * style.css의 --calf-mole-speed 로 전체 두더지 속도를 한 번에 조절합니다.
               * 1.00 = 기존 V71 속도
               * 1.50 = 50% 빠르게
               * 2.00 = 2배 빠르게
               * 0.75 = 25% 느리게
               * 원래 rise/hold/fall/wait 비율은 그대로 유지합니다.
               */
              const moleSpeed = Math.max(
                0.10,
                cssNumber('--calf-mole-speed', 1.00)
              );

              slot.face = nextFace();
              slot.phase = 'wait';
              slot.riseMs = randomBetween(
                Number(selectedScene.riseMinMs) || 210,
                Number(selectedScene.riseMaxMs) || 340
              ) / moleSpeed;
              slot.holdMs = randomBetween(
                Number(selectedScene.holdMinMs) || 520,
                Number(selectedScene.holdMaxMs) || 1050
              ) / moleSpeed;
              slot.fallMs = randomBetween(
                Number(selectedScene.fallMinMs) || 210,
                Number(selectedScene.fallMaxMs) || 340
              ) / moleSpeed;
              slot.waitUntil = now + (
                immediate
                  ? randomBetween(0, 500 / moleSpeed)
                  : randomBetween(
                      Number(selectedScene.waitMinMs) || 180,
                      Number(selectedScene.waitMaxMs) || 950
                    ) / moleSpeed
              );
              slot.phaseStart = slot.waitUntil;
            }

            function rebuildSlots(now, count) {
              slots = [];
              for (let i = 0; i < count; i++) {
                const slot = { index: i };
                resetSlot(slot, now, true);
                slots.push(slot);
              }
              lastSlotCount = count;
            }

            function resizeMoleCanvas() {
              const rect = scene.getBoundingClientRect();
              const dpr = Math.min(
                2,
                Math.max(1, window.devicePixelRatio || 1)
              );
              const cssW = Math.max(1, Math.round(rect.width));
              const cssH = Math.max(1, Math.round(rect.height));
              const pw = Math.round(cssW * dpr);
              const ph = Math.round(cssH * dpr);

              if (canvas.width !== pw || canvas.height !== ph) {
                canvas.width = pw;
                canvas.height = ph;
                canvas.style.width = cssW + 'px';
                canvas.style.height = cssH + 'px';
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.imageSmoothingEnabled = false;
              }
            }

            function smoothStep(t) {
              t = Math.max(0, Math.min(1, t));
              return t * t * (3 - 2 * t);
            }

            function animateMoles(now) {
              if (!running || !loaded) {
                lastTime = now;
                return;
              }

              lastTime = now;
              resizeMoleCanvas();

              const track = measureMoleTrack();
              const trackWidth = Math.max(1, track.right - track.left);
              const slotPitch = Math.max(
                30,
                Number(selectedScene.slotPitch) || 54
              );
              const minSlots = Math.max(
                1,
                Number(selectedScene.minSlots) || 7
              );
              const maxSlots = Math.max(
                minSlots,
                Number(selectedScene.maxSlots) || 12
              );
              const slotCount = Math.round(
                clampNumber(
                  minSlots,
                  Math.floor(trackWidth / slotPitch),
                  maxSlots
                )
              );

              if (slotCount !== lastSlotCount) {
                rebuildSlots(now, slotCount);
              }

              const visibleMin = Math.max(
                1,
                Number(selectedScene.visibleMin) || 5
              );
              const visibleMax = Math.max(
                visibleMin,
                Number(selectedScene.visibleMax) || 7
              );

              let activeCount = slots.filter(
                slot => slot.phase !== 'wait'
              ).length;

              if (activeCount < visibleMin) {
                for (const slot of slots) {
                  if (activeCount >= visibleMin) break;
                  if (slot.phase === 'wait') {
                    slot.waitUntil = now;
                    activeCount++;
                  }
                }
              }

              for (const slot of slots) {
                if (
                  slot.phase === 'wait' &&
                  now >= slot.waitUntil &&
                  activeCount < visibleMax
                ) {
                  slot.phase = 'rise';
                  slot.phaseStart = now;
                  activeCount++;
                }

                if (slot.phase === 'rise') {
                  if (now - slot.phaseStart >= slot.riseMs) {
                    slot.phase = 'hold';
                    slot.phaseStart = now;
                  }
                } else if (slot.phase === 'hold') {
                  if (now - slot.phaseStart >= slot.holdMs) {
                    slot.phase = 'fall';
                    slot.phaseStart = now;
                  }
                } else if (slot.phase === 'fall') {
                  if (now - slot.phaseStart >= slot.fallMs) {
                    resetSlot(slot, now, false);
                  }
                }
              }

              ctx.clearRect(0, 0, scene.clientWidth, scene.clientHeight);

              const faceHeight = Math.max(
                20,
                Number(selectedScene.faceHeight) || 36
              );
              const faceWidth =
                MOLE_FACE_DATA.cellW *
                (faceHeight / MOLE_FACE_DATA.cellH);
              const bottomOffset = cssNumber('--calf-mole-bottom', 0);
              const hiddenY = scene.clientHeight + 2;
              const shownY =
                scene.clientHeight - faceHeight + bottomOffset;

              for (let i = 0; i < slots.length; i++) {
                const slot = slots[i];
                if (slot.phase === 'wait') continue;

                let up = 0;
                if (slot.phase === 'rise') {
                  up = smoothStep(
                    (now - slot.phaseStart) / slot.riseMs
                  );
                } else if (slot.phase === 'hold') {
                  up = 1;
                } else if (slot.phase === 'fall') {
                  up = 1 - smoothStep(
                    (now - slot.phaseStart) / slot.fallMs
                  );
                }

                const centerX =
                  track.left +
                  trackWidth * ((i + 0.5) / slots.length);
                const drawX = centerX - faceWidth / 2;
                const drawY = hiddenY + (shownY - hiddenY) * up;
                const faceIndex = slot.face;
                const col = faceIndex % MOLE_FACE_DATA.cols;
                const row = Math.floor(faceIndex / MOLE_FACE_DATA.cols);

                ctx.drawImage(
                  faceSheet,
                  col * MOLE_FACE_DATA.cellW,
                  row * MOLE_FACE_DATA.cellH,
                  MOLE_FACE_DATA.cellW,
                  MOLE_FACE_DATA.cellH,
                  drawX,
                  drawY,
                  faceWidth,
                  faceHeight
                );
              }

              if (running) {
                requestAnimationFrame(animateMoles);
              }
            }

            faceSheet.addEventListener('load', function () {
              loaded = true;
              if (!started) {
                started = true;
                lastTime = performance.now();
                requestAnimationFrame(animateMoles);
              }
            });

            faceSheet.addEventListener('error', function () {
              console.warn(
                '[CALF mole heads] image load failed:',
                faceSheet.dataset.src
              );
              scene.classList.add('is-load-error');
            });

            sceneController = {
              setVisible: function (visible) {
                if (reduceMotion) return;
                if (visible && !loaded && !faceSheet.src) {
                  faceSheet.src = faceSheet.dataset.src;
                }
                const nextRunning = Boolean(visible);
                if (nextRunning === running) return;
                running = nextRunning;
                if (running) {
                  lastTime = performance.now();
                  if (loaded) requestAnimationFrame(animateMoles);
                }
              }
            };

            window.addEventListener(
              'resize',
              resizeMoleCanvas,
              { passive: true }
            );
          }
        }

        /* --------------------------------------------------------------
           B. V71 익사이트 바이크 장면형 애니메이션
           평지 → 점프 → 공중회전 → 전복 → 달려감 → 재탑승 → 결승.
           -------------------------------------------------------------- */
        if (selectedScene && selectedScene.kind === 'excitebike') {
          const scene = document.createElement('div');
          scene.className =
            'calf-sticky-scene is-excitebike is-' + pageContext.type;
          scene.setAttribute('aria-hidden', 'true');

          const canvas = document.createElement('canvas');
          canvas.className = 'calf-sticky-special-canvas';
          scene.appendChild(canvas);
          shell.appendChild(scene);

          const ctx = canvas.getContext('2d', { alpha: true });
          if (ctx) {
            ctx.imageSmoothingEnabled = false;

            const atlas = new Image();
            atlas.decoding = 'async';
            atlas.dataset.src =
              STICKY_ANIM_ROOT + EXCITE_ATLAS_DATA.file;

            let loaded = false;
            let running = false;
            let started = false;
            let lastTime = performance.now();
            let elapsedMs = 0;

            function resizeExciteCanvas() {
              const rect = scene.getBoundingClientRect();
              const dpr = Math.min(
                2,
                Math.max(1, window.devicePixelRatio || 1)
              );
              const cssW = Math.max(1, Math.round(rect.width));
              const cssH = Math.max(1, Math.round(rect.height));
              const pw = Math.round(cssW * dpr);
              const ph = Math.round(cssH * dpr);

              if (canvas.width !== pw || canvas.height !== ph) {
                canvas.width = pw;
                canvas.height = ph;
                canvas.style.width = cssW + 'px';
                canvas.style.height = cssH + 'px';
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.imageSmoothingEnabled = false;
              }
            }

            function clamp01(value) {
              return Math.max(0, Math.min(1, value));
            }

            function smoothStep(value) {
              const t = clamp01(value);
              return t * t * (3 - 2 * t);
            }

            function lerp(a, b, t) {
              return a + (b - a) * t;
            }

            function rideBob(timeSec, phase) {
              const amplitude =
                Number(selectedScene.rideBobPx) || 1.35;
              const hz =
                Number(selectedScene.rideBobHz) || 7.0;
              return Math.sin(
                (timeSec * hz + (phase || 0)) * Math.PI * 2
              ) * amplitude;
            }

            function drawSprite(spriteId, centerX, baseline, scale) {
              const packedIndex =
                EXCITE_ATLAS_DATA.map[String(spriteId)];
              if (packedIndex === undefined) return;

              const col = packedIndex % EXCITE_ATLAS_DATA.cols;
              const row = Math.floor(
                packedIndex / EXCITE_ATLAS_DATA.cols
              );
              const cellW = EXCITE_ATLAS_DATA.cellW;
              const cellH = EXCITE_ATLAS_DATA.cellH;
              const dw = cellW * scale;
              const dh = cellH * scale;

              ctx.drawImage(
                atlas,
                col * cellW,
                row * cellH,
                cellW,
                cellH,
                centerX - dw / 2,
                baseline - dh,
                dw,
                dh
              );
            }

            function ridePose(frameNumber) {
              const poses = [0, 1, 2, 3, 4];
              return poses[Math.floor(frameNumber) % poses.length];
            }

            function drawStaff(timeSec, frameNumber, width, baseline) {
              const appearStart =
                Number(selectedScene.staffAppearSec) || 7.0;
              const appearDuration = 0.72;
              const appear = smoothStep(
                (timeSec - appearStart) / appearDuration
              );
              if (appear <= 0) return;

              const target1 = width - 135;
              const target2 = width - 92;
              const targetFlag = width - 43;
              const outside1 = width + 45;
              const outside2 = width + 78;
              const outsideFlag = width + 112;

              let x1;
              let x2;
              let xf;

              const exitStart =
                Number(selectedScene.staffExitSec) || 11.05;
              const exitDuration = Math.max(
                0.1,
                Number(selectedScene.staffExitDurationSec) || 0.95
              );

              if (timeSec < exitStart) {
                const a = Math.min(1, appear);
                x1 = lerp(outside1, target1, a);
                x2 = lerp(outside2, target2, a);
                xf = lerp(outsideFlag, targetFlag, a);
              } else {
                const exit = smoothStep(
                  (timeSec - exitStart) / exitDuration
                );
                if (exit >= 1) return;
                x1 = lerp(target1, outside1, exit);
                x2 = lerp(target2, outside2, exit);
                xf = lerp(targetFlag, outsideFlag, exit);
              }

              const camA =
                Math.floor(frameNumber / 5) % 2 === 0 ? 36 : 40;
              const camB =
                Math.floor(frameNumber / 6) % 2 === 0 ? 38 : 42;
              const flagDownSec =
                Number(selectedScene.flagDownSec) || 8.55;
              const flag = timeSec >= flagDownSec ? 39 : 35;

              drawSprite(camA, x1, baseline, 1.80);
              drawSprite(camB, x2, baseline, 1.80);
              drawSprite(flag, xf, baseline, 1.80);
            }

            function renderExcite(timeSec) {
              const width = scene.clientWidth;
              const height = scene.clientHeight;
              ctx.clearRect(0, 0, width, height);

              const scale = Math.max(
                0.8,
                Number(selectedScene.spriteScale) || 1.80
              );
              const baseline =
                height - cssNumber('--calf-excite-bottom', 1);
              const frameNumber = timeSec * 24;

              const chase = [
                { id:28, start:5.25, end:10.15, phase:0.20 },
                { id:29, start:5.55, end:10.55, phase:0.55 },
                { id:30, start:5.85, end:10.95, phase:0.90 }
              ];

              for (const bike of chase) {
                if (
                  timeSec >= bike.start &&
                  timeSec <= bike.end + 0.45
                ) {
                  const p =
                    (timeSec - bike.start) /
                    (bike.end - bike.start);
                  const x = lerp(-55, width + 60, p);
                  drawSprite(
                    bike.id,
                    x,
                    baseline + rideBob(timeSec, bike.phase),
                    scale
                  );
                }
              }

              if (timeSec < 2.0) {
                const p = timeSec / 2.0;
                const x = lerp(-55, width * 0.16, smoothStep(p));
                drawSprite(
                  27,
                  x,
                  baseline + rideBob(timeSec, 0),
                  scale
                );
              } else if (timeSec < 3.0) {
                const p = timeSec - 2.0;
                const x = lerp(width * 0.16, width * 0.30, p);
                const lift = Math.sin(Math.PI * p) * 18;
                const seq = [5,6,7,8,9,10];
                const id = seq[
                  Math.min(
                    seq.length - 1,
                    Math.floor(p * seq.length)
                  )
                ];
                drawSprite(id, x, baseline - lift, scale);
              } else if (timeSec < 4.25) {
                const p = (timeSec - 3.0) / 1.25;
                const x = lerp(width * 0.30, width * 0.43, p);
                const lift = Math.sin(Math.PI * p) * 13 + 7;
                const seq = [12,13,14,11,15,16,17,18];
                const id = seq[
                  Math.floor(p * 2.1 * seq.length) % seq.length
                ];
                drawSprite(id, x, baseline - lift, scale);
              } else if (timeSec < 4.75) {
                const p = (timeSec - 4.25) / 0.50;
                const crashX = width * 0.43;
                if (p < 0.38) {
                  drawSprite(18, crashX, baseline, scale);
                } else {
                  drawSprite(21, crashX - 10, baseline, scale);
                  drawSprite(22, crashX + 28, baseline, scale);
                }
              } else if (timeSec < 5.95) {
                const p = (timeSec - 4.75) / 1.20;
                const crashX = width * 0.43;
                const riderX = lerp(crashX - 10, crashX + 15, p);
                const runId =
                  Math.floor(frameNumber / 3) % 2 === 0 ? 19 : 20;
                drawSprite(runId, riderX, baseline, scale);
                drawSprite(22, crashX + 28, baseline, scale);
              } else if (timeSec < 6.5) {
                const p = (timeSec - 5.95) / 0.55;
                const seq = [21,24,25,26];
                const id = seq[
                  Math.min(
                    seq.length - 1,
                    Math.floor(p * seq.length)
                  )
                ];
                drawSprite(id, width * 0.45, baseline, scale);
              } else if (timeSec < 8.2) {
                const p = (timeSec - 6.5) / 1.7;
                const x = lerp(
                  width * 0.45,
                  width * 0.78,
                  smoothStep(p)
                );
                drawSprite(
                  27,
                  x,
                  baseline + rideBob(timeSec, 0),
                  scale
                );
              } else if (timeSec < 9.0) {
                const p = (timeSec - 8.2) / 0.8;
                const x = lerp(width * 0.78, width + 65, p);
                drawSprite(
                  23,
                  x,
                  baseline + rideBob(timeSec, 0),
                  scale
                );
              }

              drawStaff(timeSec, frameNumber, width, baseline);
            }

            function animateExcite(now) {
              if (!running || !loaded) {
                lastTime = now;
                return;
              }

              const dt = Math.min(50, Math.max(0, now - lastTime));
              lastTime = now;

              const timeScale = Math.max(
                0.05,
                Number(selectedScene.timeScale) || 1
              );
              elapsedMs += dt / timeScale;

              const cycleMs = Math.max(
                1000,
                (Number(selectedScene.cycleSec) || 12.5) * 1000
              );
              const timeSec = (elapsedMs % cycleMs) / 1000;

              resizeExciteCanvas();
              renderExcite(timeSec);

              if (running) {
                requestAnimationFrame(animateExcite);
              }
            }

            atlas.addEventListener('load', function () {
              loaded = true;
              if (!started) {
                started = true;
                lastTime = performance.now();
                requestAnimationFrame(animateExcite);
              }
            });

            atlas.addEventListener('error', function () {
              console.warn(
                '[CALF excitebike] image load failed:',
                atlas.dataset.src
              );
              scene.classList.add('is-load-error');
            });

            sceneController = {
              setVisible: function (visible) {
                if (reduceMotion) return;
                if (visible && !loaded && !atlas.src) {
                  atlas.src = atlas.dataset.src;
                }
                const nextRunning = Boolean(visible);
                if (nextRunning === running) return;
                running = nextRunning;
                if (running) {
                  lastTime = performance.now();
                  if (loaded) requestAnimationFrame(animateExcite);
                }
              }
            };

            window.addEventListener(
              'resize',
              resizeExciteCanvas,
              { passive: true }
            );
          }
        }

        /* --------------------------------------------------------------
           C. V71 자동차/빗자루 PNG runner
           source frame timing + anchor + path를 그대로 재생합니다.
           -------------------------------------------------------------- */
        if (selectedScene && selectedScene.kind === 'sheet') {
          const data = STICKY_RUNNER_DATA[selectedScene.data];

          if (data) {
            const scene = document.createElement('div');
            scene.className =
              'calf-sticky-scene is-sheet-runner is-' + pageContext.type;
            scene.setAttribute('aria-hidden', 'true');

            const canvas = document.createElement('canvas');
            canvas.className = 'calf-sticky-runner-canvas';
            scene.appendChild(canvas);
            shell.appendChild(scene);

            const ctx = canvas.getContext('2d', { alpha: true });
            if (ctx) {
              ctx.imageSmoothingEnabled = false;

              const sheet = new Image();
              sheet.decoding = 'async';
              sheet.dataset.src = STICKY_ANIM_ROOT + data.file;

              let loaded = false;
              let running = false;
              let started = false;
              let lastTime = performance.now();
              let elapsedMs = 0;

              const cumulative = [0];
              for (let i = 0; i < data.durations.length; i++) {
                cumulative.push(
                  cumulative[cumulative.length - 1] +
                  Math.max(1, Number(data.durations[i]) || 1)
                );
              }

              const totalSourceMs =
                Number(data.totalMs) || cumulative[cumulative.length - 1];
              const safeOffset = Math.max(
                0,
                Math.min(
                  totalSourceMs - 1,
                  Number(selectedScene.startOffsetMs) || 0
                )
              );
              const playableSourceMs = Math.max(
                1,
                totalSourceMs - safeOffset
              );

              function resizeRunnerCanvas() {
                const rect = scene.getBoundingClientRect();
                const dpr = Math.min(
                  2,
                  Math.max(1, window.devicePixelRatio || 1)
                );
                const cssW = Math.max(1, Math.round(rect.width));
                const cssH = Math.max(1, Math.round(rect.height));
                const pw = Math.round(cssW * dpr);
                const ph = Math.round(cssH * dpr);

                if (canvas.width !== pw || canvas.height !== ph) {
                  canvas.width = pw;
                  canvas.height = ph;
                  canvas.style.width = cssW + 'px';
                  canvas.style.height = cssH + 'px';
                  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                  ctx.imageSmoothingEnabled = false;
                }
              }

              function findFrameIndex(sourceMs) {
                let low = 0;
                let high = data.frameCount - 1;

                while (low < high) {
                  const mid = Math.floor((low + high + 1) / 2);
                  if (cumulative[mid] <= sourceMs) low = mid;
                  else high = mid - 1;
                }
                return Math.max(0, Math.min(data.frameCount - 1, low));
              }

              function drawRunner(now) {
                if (!running || !loaded) {
                  lastTime = now;
                  return;
                }

                const dt = Math.min(50, Math.max(0, now - lastTime));
                lastTime = now;

                const timeScale = Math.max(
                  0.05,
                  Number(selectedScene.timeScale) || 1
                );
                elapsedMs += dt;

                const scaledCycleMs = playableSourceMs * timeScale;
                const cycleIndex = Math.floor(elapsedMs / scaledCycleMs);
                const cycleTimeMs = elapsedMs % scaledCycleMs;
                let sourceMs = safeOffset + cycleTimeMs / timeScale;

                const pingpongReturn =
                  selectedScene.direction === 'pingpong' &&
                  cycleIndex % 2 === 1;

                if (
                  pingpongReturn &&
                  selectedScene.reverseFramesOnReturn
                ) {
                  sourceMs =
                    totalSourceMs - 1 - (sourceMs - safeOffset);
                  sourceMs = Math.max(safeOffset, sourceMs);
                }

                const frameIndex = findFrameIndex(sourceMs);
                const frameStart = cumulative[frameIndex];
                const frameDuration = Math.max(
                  1,
                  Number(data.durations[frameIndex]) || 1
                );
                const frameT = Math.max(
                  0,
                  Math.min(1, (sourceMs - frameStart) / frameDuration)
                );
                const nextIndex = Math.min(
                  data.frameCount - 1,
                  frameIndex + 1
                );

                const pathA = Number(data.path[frameIndex]) || 0;
                const pathB = Number(data.path[nextIndex]);
                const pathValue = pathA +
                  ((Number.isFinite(pathB) ? pathB : pathA) - pathA) * frameT;

                resizeRunnerCanvas();
                ctx.clearRect(0, 0, scene.clientWidth, scene.clientHeight);

                const targetHeight = Math.max(
                  8,
                  Number(selectedScene.height) || data.cellH
                );
                const scale = targetHeight / data.cellH;
                const startInset = cssNumber(
                  '--calf-sticky-runner-start-inset',
                  0
                );
                const endInset = cssNumber(
                  '--calf-sticky-runner-end-inset',
                  0
                );
                const startX = startInset;
                const endX = Math.max(
                  startX + 1,
                  scene.clientWidth - endInset
                );

                let effectiveDirection = selectedScene.direction;
                if (effectiveDirection === 'pingpong') {
                  effectiveDirection = pingpongReturn ? 'rtl' : 'ltr';
                }

                const actorAnchorX = effectiveDirection === 'rtl'
                  ? endX - (endX - startX) * pathValue
                  : startX + (endX - startX) * pathValue;

                const anchorPx =
                  (Number(data.anchors[frameIndex]) || (data.cellW / 2)) * scale;
                const drawX = actorAnchorX - anchorPx;
                const baseline =
                  scene.clientHeight -
                  cssNumber('--calf-sticky-runner-bottom', 4);
                const drawY = baseline - data.cellH * scale;
                const col = frameIndex % data.cols;
                const row = Math.floor(frameIndex / data.cols);

                ctx.drawImage(
                  sheet,
                  col * data.cellW,
                  row * data.cellH,
                  data.cellW,
                  data.cellH,
                  drawX,
                  drawY,
                  data.cellW * scale,
                  data.cellH * scale
                );

                if (running) {
                  requestAnimationFrame(drawRunner);
                }
              }

              sheet.addEventListener('load', function () {
                loaded = true;
                if (!started) {
                  started = true;
                  lastTime = performance.now();
                  requestAnimationFrame(drawRunner);
                }
              });

              sheet.addEventListener('error', function () {
                console.warn(
                  '[CALF PNG runner] image load failed:',
                  sheet.dataset.src
                );
                scene.classList.add('is-load-error');
              });

              sceneController = {
                setVisible: function (visible) {
                  if (reduceMotion) return;
                  if (visible && !loaded && !sheet.src) {
                    sheet.src = sheet.dataset.src;
                  }
                  const nextRunning = Boolean(visible);
                  if (nextRunning === running) return;
                  running = nextRunning;
                  if (running) {
                    lastTime = performance.now();
                    if (loaded) requestAnimationFrame(drawRunner);
                  }
                }
              };

              window.addEventListener(
                'resize',
                resizeRunnerCanvas,
                { passive: true }
              );
            }
          }
        }

        /* --------------------------------------------------------------
           D. V71 NEXT 쿠니오 + 리키 6프레임 runner
           -------------------------------------------------------------- */
        if (selectedScene && selectedScene.kind === 'kunio-runner') {
          const scene = document.createElement('div');
          scene.className = 'calf-sticky-scene is-next is-runner-scene';
          scene.setAttribute('aria-hidden', 'true');

          const runner = document.createElement('span');
          runner.className = 'calf-next-kunio-runner';
          scene.appendChild(runner);
          shell.appendChild(scene);

          const FRAME_WIDTH = 66;
          const FRAME_COUNT = 6;
          let running = false;
          let x = cssNumber('--calf-sticky-runner-start-x', 0);
          let frame = 0;
          let frameAccumulator = 0;
          let lastTime = performance.now();

          function animateKunioRiki(now) {
            if (!running) {
              lastTime = now;
              return;
            }

            const dt = Math.min(50, Math.max(0, now - lastTime));
            lastTime = now;

            const speed = Math.max(
              1,
              cssNumber('--calf-next-kunio-run-speed', 300)
            );
            const poseFps = Math.max(
              1,
              cssNumber('--calf-next-kunio-run-pose-fps', 60)
            );

            x += speed * (dt / 1000);
            frameAccumulator += dt;

            const frameMs = 1000 / poseFps;
            while (frameAccumulator >= frameMs) {
              frameAccumulator -= frameMs;
              frame = (frame + 1) % FRAME_COUNT;
            }

            runner.style.transform = 'translate3d(' + x + 'px,0,0)';
            runner.style.backgroundPosition =
              (-frame * FRAME_WIDTH) + 'px 0';

            const endExtra = cssNumber(
              '--calf-sticky-runner-end-extra',
              0
            );

            if (x > scene.clientWidth + endExtra) {
              x = cssNumber('--calf-sticky-runner-start-x', 0);
            }

            if (running) {
              requestAnimationFrame(animateKunioRiki);
            }
          }

          sceneController = {
            setVisible: function (visible) {
              if (reduceMotion) return;
              const nextRunning = Boolean(visible);
              if (nextRunning === running) return;
              running = nextRunning;
              if (running) {
                lastTime = performance.now();
                requestAnimationFrame(animateKunioRiki);
              }
            }
          };
        }

        const clone = sourceNav.cloneNode(true);
        clone.classList.add('calf-sticky-nav');
        clone.setAttribute('aria-label', '고정 주요 메뉴');
        shell.appendChild(clone);
        document.body.appendChild(shell);

        let ticking=false;
        function update(){
          ticking=false;
          const visible=sourceNav.getBoundingClientRect().bottom<=0;
          shell.classList.toggle('is-visible',visible);
          shell.setAttribute('aria-hidden',visible?'false':'true');
          document.body.classList.toggle('calf-sticky-nav-active',visible);
          if(sceneController)sceneController.setVisible(visible);
        }
        function requestUpdate(){ if(ticking)return; ticking=true; requestAnimationFrame(update); }
        window.addEventListener('scroll',requestUpdate,{passive:true});
        window.addEventListener('resize',requestUpdate,{passive:true});
        update();
      }

      document.addEventListener('click', function (event) {
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const link = event.target.closest('.fc-nav a.nav-btn');
        if (!link) return;

        let url;
        try {
          url = new URL(link.href, location.href);
        } catch (_) {
          return;
        }
        if (url.origin !== location.origin) return;

        event.preventDefault();

        const targetPath = normalizedPath(url);
        const currentPath = normalizedPath(new URL(location.href));

        if (targetPath === currentPath && url.search === location.search) {
          history.replaceState(null, '', url.pathname + url.search + '#' + CONTENT_ID);
          smoothToContent();
          return;
        }

        try {
          sessionStorage.setItem(STORAGE_KEY, targetPath);
        } catch (_) {}

        location.href = url.pathname + url.search;
      });

      function initArrivalScroll() {
        const currentPath = normalizedPath(new URL(location.href));

        function consumeAndScroll() {
          let stored = '';
          try {
            stored = sessionStorage.getItem(STORAGE_KEY) || '';
            if (stored === currentPath) {
              sessionStorage.removeItem(STORAGE_KEY);
            }
          } catch (_) {}

          if (stored === currentPath || location.hash === '#' + CONTENT_ID) {
            /*
             * V6.18.119:
             * 100ms 대기는 없애되 '딱딱한 순간이동'도 쓰지 않습니다.
             * 170ms짜리 짧은 ease-out 스크롤로 파박 + 부드러움을 같이 잡습니다.
             */
            quickSmoothToContent();
          }
        }

        /*
         * prerender 문서는 클릭 전에 이미 JS까지 실행됩니다.
         * 실제 activation 시점에 sessionStorage의 이동 목적지를 다시 읽어
         * 메뉴 자동스크롤이 빠지지 않게 합니다.
         */
        if (document.prerendering) {
          document.addEventListener(
            'prerenderingchange',
            consumeAndScroll,
            { once: true }
          );
          return;
        }

        consumeAndScroll();
      }

      function init() {
        initArrivalScroll();

        /*
         * PERF2 · STICKY REMOTE PREWARM
         * ----------------------------------------------------------
         * 페이지 첫 진입에서는 고정 리모컨/장식 애니메이션을 만들지 않습니다.
         * 사용자가 실제로 아래로 이동하려는 순간(wheel/touch/scroll key) 또는
         * 첫 scroll 이벤트에서 즉시 한 번만 생성합니다.
         */
        let stickyReady = false;

        function startStickyRemote() {
          if (stickyReady) return;
          stickyReady = true;

          window.removeEventListener('wheel', startStickyRemote);
          window.removeEventListener('touchstart', startStickyRemote);
          window.removeEventListener('scroll', startStickyRemote);
          document.removeEventListener('keydown', handleStickyScrollKey);

          setupStickyRemote();
        }

        function handleStickyScrollKey(event) {
          if (
            event.defaultPrevented ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey
          ) {
            return;
          }

          if (
            [
              'ArrowDown',
              'PageDown',
              'End',
              ' ',
              'Spacebar'
            ].includes(event.key)
          ) {
            startStickyRemote();
          }
        }

        if (
          window.scrollY > 0 ||
          window.pageYOffset > 0
        ) {
          startStickyRemote();
          return;
        }

        window.addEventListener(
          'wheel',
          startStickyRemote,
          {
            passive: true,
            once: true
          }
        );

        window.addEventListener(
          'touchstart',
          startStickyRemote,
          {
            passive: true,
            once: true
          }
        );

        window.addEventListener(
          'scroll',
          startStickyRemote,
          {
            passive: true,
            once: true
          }
        );

        document.addEventListener(
          'keydown',
          handleStickyScrollKey
        );
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
    })();
  