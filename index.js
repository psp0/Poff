// 이미지 리소스 경로 설정 (환경변수 또는 기본값 사용)
// Vite 환경변수: VITE_ASSETS_BASE_URL (예: https://cdn.example.com/assets)
// 기본값: /assets (로컬 개발 또는 동일 도메인 배포 시)
const getEnvVar = (key, defaultValue) => {
  try {
    return (import.meta.env && import.meta.env[key]) || defaultValue;
  } catch (e) {
    return defaultValue;
  }
};
const ASSETS_BASE_URL = getEnvVar('VITE_ASSETS_BASE_URL', '');
const API_BASE_URL = getEnvVar('VITE_API_BASE_URL', '/api');

// PWA 아이콘 URL (환경변수 또는 기본 경로 사용)
// Vite 빌드 시 public 폴더의 파일들은 루트에 복사됨
const PWA_ICON_192 = getEnvVar('VITE_PWA_ICON_192', './icon-192x192.png');
const PWA_ICON_512 = getEnvVar('VITE_PWA_ICON_512', './icon-512x512.png');

const IMAGE_URLS = {
  EGG_ICON: `${ASSETS_BASE_URL}/base/img/Eggs/000.png`,
  OVAL_CHARM: `${ASSETS_BASE_URL}/custom/img/items/OVALCHARM.webp`,
  RARE_CANDY: `${ASSETS_BASE_URL}/custom/img/items/RARECANDY.webp`,
  MYSTIC_CHARM: `${ASSETS_BASE_URL}/custom/img/items/MYSTICCHARM.webp`,
  AWAKENING_CHARM: `${ASSETS_BASE_URL}/custom/img/items/AWAKENINGCHARM.webp`,
  SHINY_CHARM: `${ASSETS_BASE_URL}/custom/img/items/SHINYCHARM.webp`,
  BRILLIANCE_CHARM: `${ASSETS_BASE_URL}/custom/img/items/BRILLIANCECHARM.webp`,
  MASTERBALL: `${ASSETS_BASE_URL}/custom/img/ui/icon_ball_MASTERBALL.png`,
  POKEBALL: `${ASSETS_BASE_URL}/custom/img/ui/icon_ball_POKEBALL.png`,
  PWA_ICON_192: PWA_ICON_192,
  PWA_ICON_512: PWA_ICON_512
};

// Guest Mode State
// isGuestMode: 사용자가 명시적으로 게스트 모드를 선택한 경우에만 true
window.isGuestMode = false;

// Guest User ID
const GUEST_USER_ID = '00000000-0000-0000-0000-000000000000';

// Auth State: 'loading' | 'authenticated' | 'guest' | 'unauthenticated'
// - loading: 인증 상태 확인 중
// - authenticated: 로그인된 상태
// - guest: 게스트 모드로 사용 중
// - unauthenticated: 로그인 필요 (로그인 화면 표시)
window.authState = 'loading';

// 인증 상태 확인 헬퍼 함수
window.isAuthenticated = () => window.authState === 'authenticated';
window.isGuest = () => window.authState === 'guest';
window.isAuthReady = () => window.authState !== 'loading';

// DOM 요소
const authMessage = document.getElementById("authMessage");
const authDiv = document.getElementById("auth");
const contentDiv = document.getElementById("content");
const googleLoginBtn = document.getElementById("googleLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");


// 현재 로그인한 사용자의 UUID (Backend Sync 후)
let currentUserId = null;
let userPokemonList = []; // 사용자 포켓몬 리스트 (네비게이션용)
let currentDisplayStableId = null; // 현재 보고 있는 포켓몬의 정확한 ID (네비게이션용)
let currentDisplayIsShiny = false; // 현재 보고 있는 포켓몬의 shiny 여부 (네비게이션용)
let isCrySoundEnabled = localStorage.getItem('crySoundEnabled') !== 'false'; // 포켓몬 울음소리 설정 (기본값: true)
window.getCurrentUserId = () => currentUserId;

// Helper to get Auth Headers with Firebase ID Token
async function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (window.firebaseAuth && window.firebaseAuth.currentUser) {
    try {
      const token = await window.firebaseAuth.currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (e) {
      console.error("Failed to get ID token:", e);
    }
  }
  return headers;
}

// Helper to escape HTML for XSS prevention
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Theme-color 동적 변경 유틸리티
const ORIGINAL_THEME_COLOR = '#CD5C5C';
const MODAL_THEME_COLOR = '#2b000023';
let activeModalCount = 0;

function setThemeColor(color) {
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', color);
  }
}

function onModalOpen() {
  activeModalCount++;
  if (activeModalCount === 1) {
    setThemeColor(MODAL_THEME_COLOR);
  }
}

function onModalClose() {
  activeModalCount = Math.max(0, activeModalCount - 1);
  if (activeModalCount === 0) {
    setThemeColor(ORIGINAL_THEME_COLOR);
  }
}

// 로그인 화면 피카츄 스프라이트 초기화
function initAuthPikachuSprite() {
  const authSprite = document.getElementById('auth-sprite');
  if (!authSprite) return;

  // 피카츄 front 이미지 URL (API assets 경로)
  const pikachuImageUrl = `${ASSETS_BASE_URL}/base/img/Front/PIKACHU.png`;

  const img = new Image();
  img.onload = () => {
    const height = img.naturalHeight;
    const width = img.naturalWidth;
    const frames = Math.max(1, Math.round(width / height));

    // 애니메이션 속도 계산
    const ANIMATION_FRAME_DELAY = 90;
    const SPRITE_SPEED = 2;
    let timePerFrame = ((SPRITE_SPEED / 2) * ANIMATION_FRAME_DELAY) / 1000;
    const duration = frames * timePerFrame;

    // 동적 스타일 생성
    const animName = 'auth-pikachu-anim';
    let styleEl = document.getElementById('auth-pikachu-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'auth-pikachu-style';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      @keyframes ${animName} {
        from { background-position: 0 0; }
        to { background-position: -${width}px 0; }
      }
    `;

    // 스프라이트 스타일 적용
    authSprite.style.width = height + 'px';
    authSprite.style.height = height + 'px';
    authSprite.style.backgroundSize = `auto ${height}px`;
    authSprite.style.backgroundImage = `url("${pikachuImageUrl}")`;
    authSprite.style.animation = `${animName} ${duration}s steps(${frames}) infinite`;

    console.log(`✓ Auth Pikachu sprite loaded: ${frames} frames, ${duration.toFixed(2)}s`);
  };
  img.onerror = () => {
    console.error('Failed to load Pikachu sprite for auth screen');
  };
  img.src = pikachuImageUrl;
}

// 페이지 로드 시 피카츄 스프라이트 초기화
document.addEventListener('DOMContentLoaded', () => {
  initAuthPikachuSprite();
});

// Firebase Auth 상태 감지 및 백엔드 동기화
function initializeFirebaseListener() {
  if (window.firebaseAuth) {
    console.log("Firebase Auth initialized, registering listener");

    // Enable login button
    if (googleLoginBtn) {
      googleLoginBtn.disabled = false;
      googleLoginBtn.style.opacity = "1";
      googleLoginBtn.style.cursor = "pointer";
    }

    window.firebaseAuth.onAuthStateChanged(async (user) => {
      if (user) {
        window.isGuestMode = false;
        window.authState = 'authenticated';
        console.log("Firebase User detected:", user.uid);
        try {
          // Local API Sync
          const idToken = await user.getIdToken();
          const response = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              idToken: idToken, // Also send in body as user-management expects it
              email: user.email,
              username: user.displayName
            })
          });

          if (!response.ok) {
            throw new Error(`Sync failed with status: ${response.status}`);
          }

          const data = await response.json();

          if (data && data.success) {
            currentUserId = data.data.userId;
            const isNewUser = data.data.isNewUser;
            console.log("User synced with backend:", currentUserId, "New user:", isNewUser);

            // 게스트 모드 UI 해제
            if (typeof clearGuestModeUI === 'function') {
              clearGuestModeUI();
            }

            authDiv.style.display = "none";
            document.body.style.overflow = '';

            // 신규 사용자인 경우 약관 동의 모달 표시
            if (isNewUser) {
              contentDiv.style.display = "none";
              document.getElementById('terms-modal').style.display = 'flex';
              onModalOpen();
            } else {
              // 기존 사용자는 바로 메인 화면 표시
              contentDiv.style.display = "flex";
              // 로그인 후 초기 데이터 로드
              await loadUserPokemonIcons();

              // Notify other modules with a slight delay to ensure listeners are ready
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('user-synced', { detail: { userId: currentUserId } }));
              }, 500);
            }
          } else {
            console.error("Sync failed: No data returned");
            authMessage.textContent = "사용자 동기화 실패";
          }
        } catch (e) {
          console.error("Sync error:", e);
        }
      } else {
        console.log("No user logged in");
        currentUserId = null;

        if (window.isGuestMode || window.authState === 'guest') {
          window.authState = 'guest';
          // Guest Mode: Show Content
          authDiv.style.display = "none";
          document.body.style.overflow = '';
          contentDiv.style.display = "flex";

          // Load Dummy Data
          loadUserPokemonIcons();
          if (typeof loadExerciseData === 'function') loadExerciseData();

          // Setup UI for Guest
          const screenTimePreview = document.getElementById('screenTimePreview');
          if (screenTimePreview) {
            screenTimePreview.textContent = '📱 2시간 30분 (예시)';
            screenTimePreview.style.color = '#4F46E5';
          }

          const logoutBtn = document.getElementById("logoutBtn");
          if (logoutBtn) {
            logoutBtn.textContent = "로그인하여 시작하기";
            logoutBtn.style.backgroundColor = "#667eea";
            logoutBtn.style.color = "white";
          }

          showToast('체험 모드로 시작합니다.');
        } else {
          // Explicit Auth Mode: Show Login
          window.authState = 'unauthenticated';
          authDiv.style.display = "flex";
          document.body.style.overflow = 'hidden';
          contentDiv.style.display = "none";
        }
      }
    });
  } else {
    // Max retries: 100 * 100ms = 10 seconds
    if (!window.authInitAttempts) window.authInitAttempts = 0;
    window.authInitAttempts++;

    if (window.authInitAttempts > 100) {
      console.error("Firebase Auth initialization timed out.");
      if (authMessage) authMessage.textContent = "Firebase 초기화 실패. 페이지를 새로고침 해주세요.";
      return;
    }

    console.log(`Waiting for Firebase Auth to initialize... (${window.authInitAttempts})`);
    setTimeout(initializeFirebaseListener, 100);
  }
}

// Start listening
initializeFirebaseListener();

// 스프라이트 애니메이션 관련 데이터
const spriteData = {};


// 포켓몬 데이터를 가져오는 함수 (API 호출)
async function fetchPokemonData(pokemonStableId, isShiny = false) {
  // 인증 상태가 확정될 때까지 대기
  if (!window.isAuthReady()) {
    console.log('Waiting for auth state to be ready...');
    await new Promise(resolve => {
      const checkAuth = setInterval(() => {
        if (window.isAuthReady()) {
          clearInterval(checkAuth);
          resolve();
        }
      }, 100);
      // 최대 5초 대기 후 타임아웃
      setTimeout(() => {
        clearInterval(checkAuth);
        resolve();
      }, 5000);
    });
  }

  const userId = window.getCurrentUserId ? window.getCurrentUserId() : null;

  // API 엔드포인트 결정 (인증 상태에 따라)
  // authenticated 상태이고 userId가 있으면 collection API, 그 외에는 guest API
  const apiBase = (window.isAuthenticated() && userId) ? '/api/collection' : '/api/guest';

  try {
    const queryParams = new URLSearchParams({
      isShiny: !!isShiny
    });

    const headers = await getAuthHeaders();
    const response = await fetch(`${apiBase}/pokemon/${pokemonStableId}?${queryParams}`, { headers });

    if (!response.ok) {
      console.error('포켓몬 데이터 조회 오류:', response.statusText);
      return null;
    }

    const response_data = await response.json();

    if (!response_data || !response_data.success || !response_data.data) {
      console.error('포켓몬을 찾을 수 없습니다:', pokemonStableId);
      return null;
    }

    console.log('포켓몬 데이터 로드 완료:', response_data.data);
    return response_data.data;

  } catch (error) {
    console.error('포켓몬 데이터 가져오기 실패:', error);
    return null;
  }
}

// 배경 이미지 로드 시 fallback 처리
function loadBackgroundWithFallback(backgroundUrl, fallbackUrls) {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      resolve(backgroundUrl);
    };

    img.onerror = () => {
      // 첫 번째 fallback 시도
      if (fallbackUrls && fallbackUrls.length > 0 && fallbackUrls[0]) {
        const fallbackImg = new Image();
        fallbackImg.onload = () => resolve(fallbackUrls[0]);
        fallbackImg.onerror = () => {
          // 두 번째 fallback 시도 (normal.png)
          if (fallbackUrls.length > 1 && fallbackUrls[1]) {
            resolve(fallbackUrls[1]);
          } else {
            resolve(null);
          }
        };
        fallbackImg.src = fallbackUrls[0];
      } else {
        resolve(null);
      }
    };

    img.src = backgroundUrl;
  });
}

// 포켓몬 데이터를 화면에 표시하는 함수
// 설명글이 화면(모달)을 벗어나는지 확인하고 숨기는 함수
function adjustDescriptionVisibility() {
  // 레이아웃 계산을 위해 다음 프레임에 실행
  requestAnimationFrame(() => {
    const container = document.querySelector('.pokemon-detail-content');
    const description = document.querySelector('.pokedex-description');

    if (container && description) {
      // 먼저 보이게 설정하여 높이를 측정할 수 있게 함
      description.style.display = 'block';

      const containerRect = container.getBoundingClientRect();
      const descriptionRect = description.getBoundingClientRect();

      // 설명글의 하단이 컨테이너 하단보다 아래에 있으면 (짤리면) 숨김
      // 5px 정도의 여유를 둠
      if (descriptionRect.bottom > containerRect.bottom + 5) {
        description.style.display = 'none';
      }
    }
  });
}

// 창 크기 변경 시에도 가시성 조정
window.addEventListener('resize', adjustDescriptionVisibility);



// 포켓몬 데이터를 화면에 표시하는 함수
// 포켓몬 데이터를 화면에 표시하는 함수
async function displayPokemon(pokemonStableId, isShiny = false) {
  // 플리퍼 정면 초기화 (애니메이션 포함)
  if (typeof resetFlipperToFront === 'function') {
    resetFlipperToFront();
  }

  // 현재 표시 중인 포켓몬의 shiny 상태 업데이트 (네비게이션용)
  currentDisplayIsShiny = Boolean(isShiny);

  const pokemonData = await fetchPokemonData(pokemonStableId, isShiny);

  if (!pokemonData) {
    console.error('포켓몬 데이터를 불러올 수 없습니다.');
    return;
  }

  // UI 텍스트 업데이트 (존재하는 경우)
  const nameEl = document.getElementById('display-name');
  const descEl = document.getElementById('display-description');
  const typesContainer = document.getElementById('display-types');
  const hashtagsContainer = document.getElementById('display-hashtags');

  if (nameEl && pokemonData.pokemon) nameEl.textContent = pokemonData.pokemon.name;
  if (descEl && pokemonData.pokemon) descEl.textContent = pokemonData.pokemon.pokedex;

  // 해시태그 렌더링
  if (hashtagsContainer && pokemonData.pokemon) {
    hashtagsContainer.innerHTML = '';

    // 1. 카테고리 해시태그
    if (pokemonData.pokemon.category) {
      const catTag = document.createElement('span');
      catTag.className = 'hashtag';
      catTag.textContent = `#${pokemonData.pokemon.category}`;
      hashtagsContainer.appendChild(catTag);
    }

    // 2. 서식지 해시태그
    if (pokemonData.pokemon.habitat) {
      const habitatTag = document.createElement('span');
      habitatTag.className = 'hashtag habitat';

      const habitatMap = {
        'Grassland': '초원',
        'Forest': '숲',
        'Waters-edge': '물가',
        'Sea': '바다',
        'Cave': '동굴',
        'Mountain': '산',
        'Rough-terrain': '거친지형',
        'Urban': '도시',
        'Rare': '희귀'
      };

      const habitatName = habitatMap[pokemonData.pokemon.habitat] || pokemonData.pokemon.habitat;
      habitatTag.textContent = `#${habitatName}`;
      hashtagsContainer.appendChild(habitatTag);
    }

    // 3. 플래그 해시태그 (Legendary, Mythical 등)
    if (pokemonData.pokemon.flags) {
      let flags = pokemonData.pokemon.flags;
      // 문자열로 온 경우 파싱
      if (typeof flags === 'string') {
        try {
          flags = JSON.parse(flags);
        } catch (e) {
          console.error('Flags parse error:', e);
          flags = [];
        }
      }

      if (Array.isArray(flags)) {
        flags.forEach(flag => {
          // 표시하고 싶은 주요 플래그만 필터링하거나, 전체 표시
          // 예: Legendary, Mythical, UltraBeast, Paradox
          const displayFlags = ['Legendary', 'Mythical', 'UltraBeast', 'Paradox'];
          if (displayFlags.includes(flag)) {
            const flagTag = document.createElement('span');
            flagTag.className = `hashtag ${flag.toLowerCase()}`;

            // 한글 매핑 (필요 시)
            const flagMap = {
              'Legendary': '전설',
              'Mythical': '환상',
              'UltraBeast': '울트라비스트',
              'Paradox': '패러독스'
            };

            flagTag.textContent = `#${flagMap[flag] || flag}`;
            hashtagsContainer.appendChild(flagTag);
          }
        });
      }
    }
  }

  if (typesContainer && pokemonData.pokemon) {
    typesContainer.innerHTML = '';
    const types = [];
    if (pokemonData.pokemon.type1) types.push(pokemonData.pokemon.type1);
    if (pokemonData.pokemon.type2) types.push(pokemonData.pokemon.type2);

    types.forEach(type => {
      const typeImg = document.createElement('img');
      const typeClass = getTypeClass(type);
      typeImg.src = `${ASSETS_BASE_URL}/custom/img/ui/${typeClass}.png`;
      typeImg.alt = type;
      typeImg.className = 'type-image';
      typesContainer.appendChild(typeImg);
    });

    // 타입 개수에 따른 위치 보정 (2개일 때 왼쪽으로 더 이동)
    if (types.length > 1) {
      typesContainer.style.left = '4%';
    } else {
      typesContainer.style.left = ''; // CSS 기본값(7%) 사용
    }
  }

  // 즐겨찾기 상태 업데이트
  // 즐겨찾기 상태 업데이트
  const favBtn = document.getElementById('display-favorite-btn');
  if (favBtn) {
    // 기존 리스너 제거를 위해 복제
    const newFavBtn = favBtn.cloneNode(true);
    favBtn.parentNode.replaceChild(newFavBtn, favBtn);

    const emptyHeart = newFavBtn.querySelector('.heart-icon.empty');
    const filledHeart = newFavBtn.querySelector('.heart-icon.filled');

    // 초기 상태 설정
    if (pokemonData.is_favorite) {
      if (emptyHeart) emptyHeart.style.display = 'none';
      if (filledHeart) filledHeart.style.display = 'inline-block';
    } else {
      if (emptyHeart) emptyHeart.style.display = 'inline-block';
      if (filledHeart) filledHeart.style.display = 'none';
    }

    // 클릭 이벤트 추가
    newFavBtn.addEventListener('click', async (e) => {
      e.stopPropagation();

      if (!currentUserId) {
        if (window.isGuest()) {
          showToast('체험 모드에서는 사용할 수 없습니다. 로그인해주세요.');
          return;
        }
        showToast('로그인이 필요합니다.');
        return;
      }

      try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/collection/favorite', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            // userId is extracted from token
            pokemonStableId: pokemonStableId,
            isShiny: isShiny
          })
        });

        if (!response.ok) throw new Error('API Error');

        const result = await response.json();

        if (result.success) {
          const isFav = result.data.is_favorite;

          // UI 업데이트
          if (isFav) {
            if (emptyHeart) emptyHeart.style.display = 'none';
            if (filledHeart) filledHeart.style.display = 'inline-block';
            // 애니메이션 효과
            filledHeart.style.transform = 'scale(1.2)';
            setTimeout(() => filledHeart.style.transform = 'scale(1)', 200);
          } else {
            if (emptyHeart) emptyHeart.style.display = 'inline-block';
            if (filledHeart) filledHeart.style.display = 'none';
          }

          showToast(result.data.message);

          // 데이터 상태 업데이트 (메모리 상)
          pokemonData.is_favorite = isFav;

        } else {
          throw new Error(result.error || '즐겨찾기 변경 실패');
        }
      } catch (err) {
        console.error('Favorite toggle error:', err);
        showToast('오류가 발생했습니다.');
      }
    });
  }

  // 이로치 상태 업데이트 (UI 표시)
  // 이로치 상태 업데이트 (UI 표시)
  const shinyBtn = document.getElementById('display-shiny-btn');
  if (shinyBtn) {
    // 기존 리스너 제거를 위해 복제
    const newShinyBtn = shinyBtn.cloneNode(true);
    shinyBtn.parentNode.replaceChild(newShinyBtn, shinyBtn);

    // 상태에 따른 스타일 적용
    if (pokemonData.is_shiny) {
      newShinyBtn.style.filter = 'none';
      newShinyBtn.style.opacity = '1';
    } else {
      // 비활성화 시: 흑백 + 약간 어둡게(진한 회색) + 투명도 높임
      newShinyBtn.style.filter = 'grayscale(100%) brightness(0.7)';
      newShinyBtn.style.opacity = '0.8';
    }

    // 클릭 이벤트 추가 (토글 및 해제)
    newShinyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();

      // 1. 이미 이로치 상태이면 일반으로 돌아가기 (항상 가능)
      if (isShiny) {
        displayPokemon(pokemonStableId, false);
        return;
      }

      // 2. 일반 상태일 때: 이로치 보유 여부 확인
      if (pokemonData.has_shiny) {
        // 보유 중이면 바로 표시
        displayPokemon(pokemonStableId, true);
      } else {
        // 미보유 시: 해제 모달 표시
        const cost = 1;

        // 희귀 포켓몬 여부 확인
        let isRare = false;
        if (pokemonData.pokemon.flags) {
          let flags = pokemonData.pokemon.flags;
          if (typeof flags === 'string') {
            try { flags = JSON.parse(flags); } catch (e) { flags = []; }
          }
          if (Array.isArray(flags)) {
            isRare = flags.some(flag => ['Legendary', 'Mythical', 'UltraBeast', 'Paradox'].includes(flag));
          }
        }

        const requiredItemName = isRare ? 'Brilliance Charm' : 'Shiny Charm';
        const requiredItemNameKo = isRare ? '광휘의 부적' : '빛나는 부적';
        const requiredItemImage = isRare ? IMAGE_URLS.BRILLIANCE_CHARM : IMAGE_URLS.SHINY_CHARM;

        let charmCount = 0;

        // 아이템 보유량 확인
        try {
          const headers = await getAuthHeaders();
          const itemsResponse = await fetch('/api/user/items', { headers });
          if (itemsResponse.ok) {
            const itemsData = await itemsResponse.json();
            if (itemsData.success && itemsData.data[requiredItemName]) {
              charmCount = itemsData.data[requiredItemName].quantity;
            }
          }
        } catch (err) {
          console.error('Failed to fetch items:', err);
        }

        const safeName = escapeHtml(pokemonData.pokemon.name);
        const confirmed = await showConfirmModal(
          '이로치 획득',
          `<div style="text-align: center;">    
             이로치 <strong>${safeName}</strong>를 획득하시겠습니까?<br><br>
            <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin:10px 0;">
              <img src="${requiredItemImage}" width="32" height="32">
              <span>소모: ${requiredItemNameKo} <strong>${cost}개</strong></span>
            </div>
            <small style="color:#666">(보유: ${charmCount}개)</small>
          </div>`
        );

        if (confirmed) {
          try {
            const headers = await getAuthHeaders();
            const response = await fetch('/api/pokemon/unlock-shiny', {
              method: 'POST',
              headers: headers,
              body: JSON.stringify({
                // userId is extracted from token
                targetPokemonId: pokemonStableId
              })
            });

            const result = await response.json();
            if (result.success) {
              showToast(result.data.message);
              // 이로치 화면으로 전환
              displayPokemon(pokemonStableId, true);
              // 아이콘 목록 갱신 (백그라운드)
              loadUserPokemonIcons();
            } else {
              showToast(result.error || '이로치 해제 실패');
            }
          } catch (err) {
            console.error(err);
            showToast('오류가 발생했습니다.');
          }
        }
      }
    });
  }

  // 회전 버튼 이벤트
  const rotateBtn = document.getElementById('display-rotate-btn');
  if (rotateBtn) {
    const newRotateBtn = rotateBtn.cloneNode(true);
    rotateBtn.parentNode.replaceChild(newRotateBtn, rotateBtn);

    newRotateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const flipper = document.getElementById('pokemonFlipper');
      if (flipper) {
        // 현재 회전 각도에 180도 더하기
        currentRotation += 180;
        flipper.style.transition = 'transform 0.6s ease';
        flipper.style.transform = `translate(-50%, -50%) rotateY(${currentRotation}deg)`;
        setTimeout(() => {
          flipper.style.transition = '';
        }, 600);
      }
    });
  }

  // 배경 이미지 설정 (fallback 처리 포함)
  const background = document.getElementById('background');
  if (background && pokemonData.background_image) {
    const validBackgroundUrl = await loadBackgroundWithFallback(
      pokemonData.background_image,
      pokemonData.fallback_backgrounds
    );

    if (validBackgroundUrl) {
      background.style.setProperty('--background-image', `url("${validBackgroundUrl}")`);
      console.log('배경 이미지 로드 완료:', validBackgroundUrl);
    }
  }

  // 스프라이트 설정
  const frontSpeed = pokemonData.pokemon.front_animation_speed !== undefined ? pokemonData.pokemon.front_animation_speed : 2;
  const backSpeed = pokemonData.pokemon.back_animation_speed !== undefined ? pokemonData.pokemon.back_animation_speed : 2;

  setupSprite('sprite-front', pokemonData.front_image, frontSpeed);
  setupSprite('sprite-back', pokemonData.back_image, backSpeed);

  // 울음소리 재생
  if (pokemonData.cry_sound && isCrySoundEnabled) {
    const audio = new Audio(pokemonData.cry_sound);
    audio.volume = 0.01;
    audio.play().catch(err => {
      console.error('울음소리 재생 실패:', err);
    });
  }

  // 설명글 가시성 조정
  adjustDescriptionVisibility();

  console.log(`포켓몬 표시 완료: ${pokemonData.pokemon.name} (${pokemonStableId})`);
}

// 로그인 함수
// 구글 로그인 함수
// 구글 로그인 함수
if (googleLoginBtn) {
  // 초기 상태: 비활성화 (Firebase 로드 대기)
  googleLoginBtn.disabled = true;
  googleLoginBtn.style.opacity = "0.5";
  googleLoginBtn.style.cursor = "wait";

  googleLoginBtn.addEventListener("click", () => {
    // 중요: iOS PWA 팝업 차단을 방지하기 위해 비동기(await) 없이 즉시 호출해야 함
    if (!window.firebaseAuth || !window.googleProvider || !window.signInWithPopup) {
      console.warn("Firebase Auth not ready yet");
      return;
    }

    // authMessage.textContent = "Google 로그인 팝업을 띄우는 중..."; // iOS 팝업 차단 방지를 위해 DOM 업데이트 제거

    // 즉시 실행 (Promise 체이닝 사용)
    window.signInWithPopup(window.firebaseAuth, window.googleProvider)
      .then((result) => {
        console.log("Popup login success:", result.user.uid);
        authMessage.textContent = "로그인 성공!";
        // onAuthStateChanged에서 처리됨
      })
      .catch((error) => {
        console.error("Google Login Error:", error);
        authMessage.textContent = "로그인 실패: " + error.message;

        if (error.code === 'auth/popup-blocked') {
          authMessage.textContent = "팝업 차단을 허용하거나 로그인 버튼을 한번 더 눌러주세요.";
        }
      });
  });
}

// 게스트 로그인 (둘러보기)
const guestLoginBtn = document.getElementById("guestLoginBtn");
if (guestLoginBtn) {
  guestLoginBtn.addEventListener("click", async () => {
    console.log("Guest login button clicked");
    try {
      window.isGuestMode = true;
      window.authState = 'guest';

      // 게스트 유저 ID 설정 (DB에 미리 생성된 게스트 유저)
      currentUserId = GUEST_USER_ID;

      authDiv.style.display = "none";
      document.body.style.overflow = '';
      contentDiv.style.display = "flex";

      // 실제 API를 통해 게스트 유저 데이터 로드
      await loadUserPokemonIcons();

      // 운동 데이터 로드 (ExerciseManager가 초기화되어 있다면)
      if (typeof loadExerciseData === 'function') {
        await loadExerciseData();
      }

      // 스크린타임 더미 데이터 설정 (UI상)
      const screenTimePreview = document.getElementById('screenTimePreview');
      if (screenTimePreview) {
        screenTimePreview.textContent = '📱 2시간 30분 (예시)';
        screenTimePreview.style.color = '#4F46E5';
      }

      // 로그아웃 버튼을 로그인 버튼으로 변경
      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) {
        logoutBtn.textContent = "로그인하여 시작하기";
        logoutBtn.style.backgroundColor = "#667eea";
        logoutBtn.style.color = "white";
      }

      // 게스트 모드 UI 설정 (저장 버튼들 비활성화)
      setupGuestModeUI();

      showToast('체험 모드로 시작합니다. 데이터 저장은 로그인 후 가능합니다.');
    } catch (error) {
      console.error("Guest login error:", error);
      showToast('체험 모드 시작 중 오류가 발생했습니다.');
    }
  });
} else {
  console.error("guestLoginBtn not found in DOM");
}

// 로그아웃 함수
// 로그아웃 함수
logoutBtn.addEventListener("click", async () => {
  if (window.isGuestMode || window.authState === 'guest') {
    window.isGuestMode = false;
    window.authState = 'unauthenticated';
    // Switch to Auth Screen
    authDiv.style.display = "flex";
    document.body.style.overflow = 'hidden';
    contentDiv.style.display = "none";
    return;
  }

  try {
    await window.firebaseSignOut(window.firebaseAuth);
    currentUserId = null;
    window.authState = 'unauthenticated';
    authMessage.textContent = "로그아웃 되었습니다.";
    // UI 변경은 onAuthStateChanged에서 처리됨
  } catch (e) {
    console.error("Logout error:", e);
  }
});


// 플레이스홀더 이미지 (텍스트 없는 버전)
const placeholderDataUrl =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="%23eeeeee"/></svg>';

// Asset URL 빌더 함수
function buildAssetUrl(category, folder, filename) {
  // category: 'base' or 'custom'
  // folder: e.g., 'img/Icons', 'img/Front'
  // filename: e.g., 'PIKACHU.png'
  return `${ASSETS_BASE_URL}/${category}/${folder}/${filename}`;
}

// 이미지 URL 생성기 (ASSETS_BASE_URL 사용)
function getPokemonImageUrl(imageName, formSuffix, imageType = "icon", isShiny = false) {
  if (!imageName) return placeholderDataUrl;

  // imageType에 따른 폴더 결정
  let folder;
  if (imageType === "icon") {
    folder = isShiny ? "img/Icons shiny" : "img/Icons";
  } else {
    // Front, Back 등
    folder = isShiny ? `img/${imageType} shiny` : `img/${imageType}`;
  }

  const fileName = formSuffix ? `${imageName}${formSuffix}.png` : `${imageName}.png`;

  // buildAssetUrl 함수를 사용하여 올바른 인코딩 적용
  return buildAssetUrl('base', folder, fileName);
}

// 포켓몬 상세 표시 (진화 트리에서 클릭 시)
async function showPokemonDetail(pokemonStableId, formSuffix, isShiny = false) {
  try {
    showLoadingState();
    await displayPokemon(pokemonStableId, isShiny);
  } catch (error) {
    console.error('Error in showPokemonDetail:', error);
    showToast('정보를 불러오는 중 오류가 발생했습니다.');
  } finally {
    hideLoadingState();
  }
}


// 아이콘 컬렉션 새로고침 버튼
const refreshIconsBtn = document.getElementById('refreshIconsBtn');
if (refreshIconsBtn) {
  refreshIconsBtn.addEventListener('click', async () => {
    await loadUserPokemonIcons();
  });
}

// 네비게이션 중 중복 호출 방지 플래그
let isNavigating = false;

// 포켓몬 네비게이션 함수
async function navigatePokemon(direction) {
  console.log('=== navigatePokemon called ===');
  console.log('userPokemonList length:', userPokemonList?.length);
  console.log('currentDisplayStableId:', currentDisplayStableId);

  if (!userPokemonList || userPokemonList.length === 0 || !currentDisplayStableId) return;

  // 중복 호출 방지
  if (isNavigating) {
    console.log('Navigation already in progress, skipping...');
    return;
  }

  // display_stable_id와 is_shiny로 정확한 현재 위치 찾기
  // shiny 아이콘이 없어서 일반 아이콘으로 표시되더라도, is_shiny 상태가 다르면 다른 항목으로 취급
  const currentIndex = userPokemonList.findIndex(icon =>
    icon.display_stable_id === currentDisplayStableId &&
    Boolean(icon.is_shiny) === currentDisplayIsShiny
  );
  console.log('currentIndex:', currentIndex, 'is_shiny:', currentDisplayIsShiny);

  if (currentIndex === -1) {
    console.warn('Current pokemon not found in list:', currentDisplayStableId, 'is_shiny:', currentDisplayIsShiny);
    // 리스트 내용 확인
    console.log('userPokemonList IDs:', userPokemonList.map(p => ({ id: p.display_stable_id, shiny: p.is_shiny })));
    return;
  }

  let nextIndex = currentIndex + direction;
  if (nextIndex < 0) nextIndex = userPokemonList.length - 1;
  if (nextIndex >= userPokemonList.length) nextIndex = 0;

  const nextPokemon = userPokemonList[nextIndex];
  const currentPokemon = userPokemonList[currentIndex];

  console.log('currentPokemon:', currentPokemon.display_stable_id, currentPokemon.base_image_name);
  console.log('nextPokemon:', nextPokemon.display_stable_id, nextPokemon.base_image_name);
  console.log('nextIndex:', nextIndex);

  isNavigating = true;

  try {
    // currentDisplayStableId와 currentDisplayIsShiny를 먼저 업데이트 (중요!)
    currentDisplayStableId = nextPokemon.display_stable_id;
    currentDisplayIsShiny = Boolean(nextPokemon.is_shiny);
    console.log('Updated currentDisplayStableId to:', currentDisplayStableId, 'is_shiny:', currentDisplayIsShiny);

    // 동일 진화 체인인지 확인 (base_image_name이 같으면 같은 진화 체인)
    if (currentPokemon.base_image_name === nextPokemon.base_image_name) {
      // 같은 진화 체인 내에서 이동: displayPokemon만 호출
      console.log('Same evolution chain, calling displayPokemon directly');
      await displayPokemon(nextPokemon.display_stable_id, nextPokemon.is_shiny);
    } else {
      // 다른 진화 체인으로 이동: 진화 트리 새로 로드
      console.log('Different evolution chain, calling showIconGroupDetail');
      await showIconGroupDetail(nextPokemon.base_image_name, nextPokemon.display_stable_id, nextPokemon.is_shiny);
    }
  } finally {
    isNavigating = false;
    console.log('=== navigatePokemon completed ===');
  }
}

// 네비게이션 버튼 이벤트 리스너
const prevBtn = document.getElementById('prev-pokemon-btn');
const nextBtn = document.getElementById('next-pokemon-btn');

if (prevBtn) {
  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navigatePokemon(-1);
  });
}

if (nextBtn) {
  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navigatePokemon(1);
  });
}

// 사용자 포켓몬 아이콘 컬렉션 불러오기 함수
// 사용자 포켓몬 아이콘 컬렉션 불러오기 함수
async function loadUserPokemonIcons() {
  const grid = document.getElementById('iconCollectionGrid');
  if (!grid) return;

  const contentSection = grid.parentElement;
  let statusMsg = contentSection.querySelector('.icon-status-message');

  // 상태 메시지 요소가 없으면 생성
  if (!statusMsg) {
    statusMsg = document.createElement('div');
    statusMsg.className = 'icon-status-message';
    contentSection.insertBefore(statusMsg, grid);
  }

  try {
    // 로그인 체크 (인증 상태 기반)
    if (!currentUserId && !window.isGuest()) {
      statusMsg.textContent = '로그인이 필요합니다.';
      statusMsg.style.display = 'block';
      grid.style.display = 'none';
      return;
    }

    // 세대별 정렬 모드인지 확인
    const isGenerationSort = currentFilter.sort === 'generation';

    let icons = [];
    // API 호출 (인증 상태에 따라 결정)
    const apiBase = window.isGuest() ? '/api/guest' : '/api/collection';
    // 정렬 옵션에 따라 API 엔드포인트 결정
    const apiEndpoint = isGenerationSort
      ? `${apiBase}/all-pokemon`
      : `${apiBase}/icons`;

    const headers = await getAuthHeaders();
    const response = await fetch(apiEndpoint, { headers });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const result = await response.json();
    icons = result.data;

    userPokemonList = icons; // 리스트 저장 (네비게이션용 - 전체 목록)

    if (!icons || icons.length === 0) {
      statusMsg.textContent = '아직 보유한 포켓몬이 없습니다.';
      statusMsg.style.display = 'block';
      grid.style.display = 'none';
      return;
    }

    // 표시할 아이콘 목록 (이제 displayIcons는 icons와 동일)
    let displayIcons = icons;

    // 필터 적용
    const filteredIcons = typeof getFilteredPokemonList === 'function'
      ? getFilteredPokemonList(displayIcons)
      : displayIcons;

    // 필터 결과가 없는 경우
    if (filteredIcons.length === 0) {
      statusMsg.innerHTML = `
        <div class="no-filter-results">
          <div class="no-filter-results-icon">🔍</div>
          <div class="no-filter-results-text">필터 조건에 맞는 포켓몬이 없습니다.<br>필터를 변경해보세요.</div>
        </div>
      `;
      statusMsg.style.display = 'block';
      grid.style.display = 'none';
      return;
    }

    // 데이터가 있으면 상태 메시지 숨기고 그리드 표시
    statusMsg.style.display = 'none';
    grid.style.display = 'grid';

    // 포켓몬 카드 생성 함수
    const createPokemonCard = (icon, hideProgressBar = false) => {
      // 퍼센트 계산
      const normalPercent = icon.completion_percentage || 0;
      const shinyPercent = icon.total_count > 0 ? (icon.shiny_owned_count / icon.total_count * 100) : 0;

      // 100% 완료 시 아이콘 추가 (세대별 정렬에서는 숨김)
      let completeIcon = '';
      if (!hideProgressBar) {
        if (normalPercent >= 100 && shinyPercent >= 100) {
          // 둘 다 100%: MASTERBALL 표시
          completeIcon = `<div class="progress-complete-icon visible">
             <img src="${IMAGE_URLS.MASTERBALL}" alt="완료">
           </div>`;
        } else if (normalPercent >= 100) {
          // Green만 100%: POKEBALL 표시
          completeIcon = `<div class="progress-complete-icon visible">
             <img src="${IMAGE_URLS.POKEBALL}" alt="완료">
           </div>`;
        } else {
          // 둘 다 100% 아님: 빈 상태
          completeIcon = `<div class="progress-complete-icon">
             <img src="" alt="">
           </div>`;
        }
      }

      // 즐겨찾기 아이콘 (showFavoriteIcon 설정에 따라 표시)
      let favoriteIconHtml = '';
      if (icon.is_favorite && currentFilter.showFavoriteIcon !== false) {
        favoriteIconHtml = `<div class="favorite-icon-overlay">
          <img src="${ASSETS_BASE_URL}/custom/img/ui/favorite.png" alt="Favorite">
        </div>`;
      }

      // Progress bar HTML (세대별 정렬에서는 숨김)
      const progressBarHtml = hideProgressBar ? '' : `
          <div class="collection-progress-bg">
            <div class="collection-progress-fill" style="--collection-progress-width: ${normalPercent}%;"></div>
          </div>
          <div class="shiny-progress-bg">
            <div class="shiny-progress-fill" style="--shiny-progress-width: ${shinyPercent}%;"></div>
          </div>`;

      return `
        <div class="pokemon-card pokemon-icon${hideProgressBar ? ' no-progress' : ''}" role="button" tabindex="0" 
             aria-label="${icon.base_image_name} 아이콘" 
             onclick="showIconGroupDetail('${icon.base_image_name}', '${icon.display_stable_id}', ${icon.is_shiny})" 
             onkeypress="if(event.key === 'Enter' || event.key === ' ') showIconGroupDetail('${icon.base_image_name}', '${icon.display_stable_id}', ${icon.is_shiny})">
          ${completeIcon}
          ${favoriteIconHtml}
          <div class="pokemon-sprite" data-src="${icon.icon_url}"></div>
          ${progressBarHtml}
        </div>
      `;
    };

    // 세대별 정렬 모드: 세대 구분선 포함 렌더링
    let gridContent = '';
    if (isGenerationSort) {
      let currentGeneration = null;
      filteredIcons.forEach(icon => {
        const generation = icon.generation || 1;
        if (generation !== currentGeneration) {
          currentGeneration = generation;
          gridContent += `<div class="generation-divider"><span>${generation}</span></div>`;
        }
        gridContent += createPokemonCard(icon, true); // 세대별 정렬에서는 progress bar 숨김
      });
    } else {
      gridContent = filteredIcons.map(icon => createPokemonCard(icon, false)).join('');
    }

    grid.innerHTML = gridContent;

    // 포켓몬 스프라이트 설정
    grid.querySelectorAll('.pokemon-sprite').forEach(sprite => {
      setupPokemonSprite(sprite);
    });

  } catch (err) {
    console.error("Unexpected error in loadUserPokemonIcons:", err);
    statusMsg.textContent = '오류가 발생했습니다.';
    statusMsg.style.display = 'block';
    grid.style.display = 'none';
  }
}

// 진화 트리 스켈레톤 렌더링
function renderEvolutionSkeleton() {
  const diagramDiv = document.getElementById('evolution-diagram');
  if (!diagramDiv) return;

  // 스켈레톤 구조 생성 (3단계 예시)
  let html = '';
  for (let i = 0; i < 3; i++) {
    html += `<div class="evolution-level skeleton-level">
      <div class="forms-column">
        <div class="evolution-pokemon skeleton-wrapper">
          <div class="evolution-skeleton-item skeleton"></div>
          <div class="evolution-skeleton-text skeleton"></div>
        </div>
      </div>
    </div>`;
  }
  diagramDiv.innerHTML = html;
}

// 메인 디스플레이 로딩 상태 표시 (Fade Out)
function showLoadingState() {
  const displayArea = document.querySelector('.pokemon-display-area');
  if (displayArea) {
    displayArea.classList.add('fading');
  }
}

// 메인 디스플레이 로딩 상태 숨김 (Fade In)
function hideLoadingState() {
  const displayArea = document.querySelector('.pokemon-display-area');
  if (displayArea) {
    // 부드러운 전환을 위해 약간의 지연 후 클래스 제거 (선택사항, 여기서는 즉시 제거)
    requestAnimationFrame(() => {
      displayArea.classList.remove('fading');
    });
  }
}

// 아이콘 그룹 상세 보기 - 진화도 다이어그램 표시
// 아이콘 그룹 상세 보기 - 진화도 다이어그램 표시
async function showIconGroupDetail(baseImageName, specificId = null, isShiny = false) {
  console.log("Icon group clicked:", baseImageName, "specificId:", specificId);

  // 현재 포켓몬 ID와 shiny 상태 설정 (네비게이션용)
  // 네비게이션 중일 때는 이미 navigatePokemon에서 설정했으므로 건너뜀
  if (!isNavigating) {
    if (specificId) {
      currentDisplayStableId = specificId;
      currentDisplayIsShiny = Boolean(isShiny);
    } else {
      // specificId가 없을 때는 리스트에서 해당 base_image_name의 첫 번째 항목 사용
      const foundIcon = userPokemonList.find(icon => icon.base_image_name === baseImageName);
      currentDisplayStableId = foundIcon ? foundIcon.display_stable_id : null;
      currentDisplayIsShiny = foundIcon ? Boolean(foundIcon.is_shiny) : false;
    }
  }

  try {
    if (!currentUserId && !window.isGuest()) {
      showToast('로그인이 필요합니다.');
      return;
    }

    // 모달 열기
    const evolutionModal = document.getElementById('evolution-modal');
    if (evolutionModal) {
      evolutionModal.style.display = 'block';
      document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
      onModalOpen();
      // 모달 열릴 때 플리퍼 정면 초기화
      if (typeof resetFlipperToFront === 'function') {
        resetFlipperToFront();
      }
    }

    // 기존 데이터 유지하면서 로딩 상태 표시 (깜빡임 방지)
    showLoadingState();

    // 진화 트리 스켈레톤 표시
    renderEvolutionSkeleton();

    // API 호출 (인증 상태에 따라 결정)
    const apiBase = window.isGuest() ? '/api/guest' : '/api/collection';
    const headers = await getAuthHeaders();
    const response = await fetch(`${apiBase}/evolution/${baseImageName}`, { headers });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const result = await response.json();
    const evolutionData = result.data;

    if (!evolutionData || !evolutionData.evolution_tree) {
      throw new Error('Invalid data format');
    }

    // 렌더링
    renderEvolutionDiagram(evolutionData);

    // 상세 정보 표시 (첫 번째 폼 기준)
    // 상세 정보 표시: 보유한 포켓몬 중 가장 높은 진화 단계, 폼 변화 우선 표시
    let targetStableId = specificId;
    const levels = evolutionData.evolution_tree.levels;

    if (!targetStableId) {
      // 1. 진화 레벨 역순 탐색 (진화체 우선)
      for (let i = levels.length - 1; i >= 0; i--) {
        const level = levels[i];
        // 2. 폼 역순 탐색 (폼 변화 우선: 보통 기본형이 먼저 오고 폼이 뒤에 오므로 역순이 폼 우선)
        for (let j = level.forms.length - 1; j >= 0; j--) {
          const form = level.forms[j];
          if (form.is_owned) {
            targetStableId = form.stable_id;
            break;
          }
        }
        if (targetStableId) break;
      }

      // fallback: 보유한 게 없으면(오류?) 기본형 표시
      if (!targetStableId && levels.length > 0 && levels[0].forms.length > 0) {
        targetStableId = levels[0].forms[0].stable_id;
      }
    }

    if (targetStableId) {
      // 메인 포켓몬 표시 (비동기 실행)
      // displayPokemon이 UI 텍스트도 업데이트함
      await displayPokemon(targetStableId, !!isShiny);
    }



    // 회전 버튼 이벤트 (한 번만 등록되도록 수정 필요하지만, 현재 구조상 매번 등록해도 큰 문제는 없음. 
    // 다만 중복 등록 방지를 위해 기존 리스너 제거가 필요할 수 있음.
    // 여기서는 간단히 기존 로직 유지)
    const rotateBtn = document.getElementById('display-rotate-btn');
    if (rotateBtn) {
      const newRotateBtn = rotateBtn.cloneNode(true);
      rotateBtn.parentNode.replaceChild(newRotateBtn, rotateBtn);
      newRotateBtn.addEventListener('click', () => {
        const flipper = document.getElementById('pokemonFlipper');
        if (flipper) {
          // 현재 회전 각도에 180도 더하기
          currentRotation += 180;
          flipper.style.transition = 'transform 0.6s ease';
          flipper.style.transform = `translate(-50%, -50%) rotateY(${currentRotation}deg)`;
          setTimeout(() => {
            flipper.style.transition = '';
          }, 600);
        }
      });
    }

  } catch (err) {
    console.error("Error loading evolution details:", err);
    showToast('상세 정보를 불러오는 중 오류가 발생했습니다.');
    if (document.getElementById('evolution-diagram')) {
      document.getElementById('evolution-diagram').innerHTML = '<div style="text-align:center; color:red;">오류 발생</div>';
    }
  } finally {
    hideLoadingState();
  }
}

// 타입 이름을 CSS 클래스명으로 변환하는 헬퍼 함수
function getTypeClass(typeName) {
  const typeMap = {
    '풀': 'grass',
    '독': 'poison',
    '불꽃': 'fire',
    '물': 'water',
    '벌레': 'bug',
    '노말': 'normal',
    '비행': 'flying',
    '전기': 'electric',
    '땅': 'ground',
    '페어리': 'fairy',
    '격투': 'fighting',
    '에스퍼': 'psychic',
    '바위': 'rock',
    '강철': 'steel',
    '얼음': 'ice',
    '고스트': 'ghost',
    '드래곤': 'dragon',
    '악': 'dark'
  };
  return typeMap[typeName] || 'normal';
}

// 진화도 다이어그램 렌더링
function renderEvolutionDiagram(data) {
  const { evolution_tree, completion } = data;

  // 진행 바
  const progressBar = document.getElementById('evolution-progress-bar');
  progressBar.style.width = `${completion.completion_percentage}%`;
  progressBar.className = `progress-bar ${completion.is_complete ? 'complete' : ''}`;

  // 진화 다이어그램 렌더링
  const diagramDiv = document.getElementById('evolution-diagram');
  diagramDiv.innerHTML = '';

  // 각 레벨의 폼 인덱스를 추적하기 위한 맵 (image_name + form_suffix -> 인덱스)
  const formIndexMap = new Map();

  // 보유 중인 포켓몬의 ImageName -> StableId 맵핑 (진화 시 부모 ID 찾기용)
  const ownedPokemonMap = new Map();

  // 보유 중인 포켓몬의 StableId 집합 (빠른 조회용)
  const ownedStableIds = new Set();

  // 1차 순회: 보유 포켓몬 맵핑 생성
  evolution_tree.levels.forEach(level => {
    level.forms.forEach(form => {
      if (form.is_owned) {
        ownedStableIds.add(form.stable_id);
        // image_name 사용 (backend에서 전달됨)
        const imageName = form.image_name;
        // 기본형(suffix가 없는 경우) 우선 저장, 아니면 덮어쓰기 (진화는 보통 기본형에서 하므로)
        if (!form.form_suffix || !ownedPokemonMap.has(imageName)) {
          ownedPokemonMap.set(imageName, form.stable_id);
        }
        // stable_id도 키로 추가 (pre_evolution_pokemon이 stable_id를 반환하므로)
        ownedPokemonMap.set(form.stable_id, form.stable_id);
      }
    });
  });

  console.log('Owned Pokemon Map:', Object.fromEntries(ownedPokemonMap));

  evolution_tree.levels.forEach((level, levelIndex) => {
    const levelDiv = document.createElement('div');
    levelDiv.className = 'evolution-level';

    // 폼들을 세로로 나열
    const formsColumn = document.createElement('div');
    formsColumn.className = 'forms-column';

    level.forms.forEach((form, formIndex) => {
      const pokemonDiv = document.createElement('div');
      // owned 클래스는 보유 시, unlockable은 해금 가능 시
      // Restore 'not-owned' class logic
      pokemonDiv.className = `evolution-pokemon ${form.is_owned ? 'owned' : 'not-owned'}`;

      pokemonDiv.setAttribute('data-level', levelIndex);
      pokemonDiv.setAttribute('data-form-index', formIndex);

      // image_name 사용
      const imageName = form.image_name;
      pokemonDiv.setAttribute('data-image-name', imageName);
      pokemonDiv.setAttribute('data-form-suffix', form.form_suffix || '');

      // 폼 위치 추적
      const formKey = `${imageName}${form.form_suffix || ''}`;
      formIndexMap.set(formKey, { levelIndex, formIndex });

      // 클릭 이벤트 및 상태 처리
      if (form.is_owned) {
        pokemonDiv.onclick = () => showPokemonDetail(form.stable_id, '', false);
      } else {
        // 미보유 상태: 진화 가능 여부 또는 폼 해제 가능 여부 확인
        let canEvolve = false;
        let canUnlockForm = false;
        let preEvoStableId = null;

        // 1. 진화 가능 확인
        if (form.pre_evolution_pokemon) {
          const hasPreEvo = ownedPokemonMap.has(form.pre_evolution_pokemon);
          console.log(`Checking evolution for ${form.name} (${imageName}): Pre-Evo=${form.pre_evolution_pokemon}, Owned=${hasPreEvo}`);
          if (hasPreEvo) {
            canEvolve = true;
            preEvoStableId = ownedPokemonMap.get(form.pre_evolution_pokemon);
          }
        }

        // 2. 폼 해제 가능 확인 (기본형 보유 시)
        // 조건: 폼 서픽스가 있고, 해당 포켓몬의 기본형(image_name)을 보유하고 있음
        if (form.form_suffix && ownedPokemonMap.has(imageName)) {
          canUnlockForm = true;

          // 추가 검증: 폼 이름(괄호 안 내용)이 일치하는 전 단계 포켓몬이 존재하는지 확인
          // 예: "윈디 (히스이의 모습)"인 경우, 전 단계인 가디 중에 "가디 (히스이의 모습)"이 있는지 확인
          const match = form.name.match(/\((.*?)\)/);
          if (match) {
            const formType = match[1]; // 예: "히스이의 모습"

            // 현재 레벨에서 기본형(suffix 없는 것)을 찾아 진화 전 정보 확인
            const baseForm = level.forms.find(f => f.image_name === imageName && !f.form_suffix);

            if (baseForm && baseForm.pre_evolution_pokemon) {
              const preEvoImageName = baseForm.pre_evolution_pokemon;

              // 전체 트리에서 진화 전 포켓몬이 있는 레벨 찾기
              let preEvoLevel = null;
              for (const l of evolution_tree.levels) {
                if (l.forms.some(f => f.image_name === preEvoImageName)) {
                  preEvoLevel = l;
                  break;
                }
              }

              if (preEvoLevel) {
                // 진화 전 포켓몬들 중 같은 폼 이름(괄호 포함)을 가진 폼 찾기
                const targetPreForm = preEvoLevel.forms.find(f => f.name.includes(`(${formType})`));

                if (targetPreForm) {
                  // 매칭되는 전 단계 폼이 존재함 -> 해당 폼을 보유하고 있어야 함
                  if (!ownedStableIds.has(targetPreForm.stable_id)) {
                    canUnlockForm = false;
                    console.log(`폼 해제 불가: ${form.name}은(는) ${targetPreForm.name}이(가) 필요합니다.`);
                  }
                }
              }
            }
          }
        }

        if (canEvolve) {
          pokemonDiv.classList.add('unlockable');

          // 희귀한 포켓몬 여부 확인 (Legendary, Mythical, UltraBeast, Paradox)
          const isRarePokemon = form.flags && (
            form.flags.includes('Legendary') ||
            form.flags.includes('Mythical') ||
            form.flags.includes('UltraBeast') ||
            form.flags.includes('Paradox')
          );

          // 비용: 레벨 1 -> 1개, 레벨 2 -> 2개 (레벨 인덱스 사용)
          // 단, levelIndex가 0이면 진화가 아님.
          // 희귀한 포켓몬은 3개
          const cost = isRarePokemon ? 3 : levelIndex;

          // 진화 아이콘 표시 (선택사항)
          const badge = document.createElement('div');
          badge.className = 'unlock-badge evolution';
          badge.innerHTML = `<img src="${IMAGE_URLS.RARE_CANDY}" alt="진화" style="width:100%; height:100%;">`;
          pokemonDiv.appendChild(badge);

          pokemonDiv.onclick = (e) => {
            e.stopPropagation();
            // baseImageName은 그룹의 기준이 되는 이름 (보통 첫 번째 레벨의 첫 번째 폼의 이미지 이름)
            const rootImageName = evolution_tree.levels[0].forms[0].stable_id.replace(/_.*$/, '');
            handleEvolutionClick(preEvoStableId, form.stable_id, form.name, cost, rootImageName);
          };
        } else if (canUnlockForm) {
          pokemonDiv.classList.add('unlockable');

          // 희귀한 포켓몬 여부 확인 (Legendary, Mythical, UltraBeast, Paradox)
          const isRarePokemon = form.flags && (
            form.flags.includes('Legendary') ||
            form.flags.includes('Mythical') ||
            form.flags.includes('UltraBeast') ||
            form.flags.includes('Paradox')
          );
          const itemImage = isRarePokemon ? IMAGE_URLS.AWAKENING_CHARM : IMAGE_URLS.MYSTIC_CHARM;
          const itemAlt = isRarePokemon ? "각성" : "폼 해제";

          // 폼 해제 아이콘 표시
          const badge = document.createElement('div');
          badge.className = 'unlock-badge form';
          badge.innerHTML = `<img src="${itemImage}" alt="${itemAlt}" style="width:100%; height:100%;">`;
          pokemonDiv.appendChild(badge);

          pokemonDiv.onclick = (e) => {
            e.stopPropagation();
            const rootImageName = evolution_tree.levels[0].forms[0].stable_id.replace(/_.*$/, '');
            handleFormUnlockClick(form.stable_id, form.name, rootImageName, isRarePokemon);
          };
        } else {
          pokemonDiv.classList.add('locked');
          pokemonDiv.onclick = () => {
            // 잠김 메시지
            // alert('아직 획득할 수 없습니다.');
          };
        }
      }

      // 아이콘 이미지
      const spriteDiv = document.createElement('div');
      spriteDiv.className = 'pokemon-sprite';
      spriteDiv.setAttribute('data-src', form.icon_url);
      spriteDiv.setAttribute('data-fallback-image', form.image_name);
      spriteDiv.setAttribute('data-fallback-suffix', form.form_suffix || '');

      pokemonDiv.appendChild(spriteDiv);

      // 포켓몬 이름
      const nameDiv = document.createElement('div');
      nameDiv.className = 'pokemon-name';
      nameDiv.textContent = form.name;
      pokemonDiv.appendChild(nameDiv);

      // 이전 진화 정보가 있으면 화살표 표시 (첫 레벨 제외)
      if (levelIndex > 0 && (form.pre_evolution_pokemon || form.pre_evolution_form_suffix)) {
        const arrowDiv = document.createElement('div');
        arrowDiv.className = 'evolution-arrow-indicator';
        arrowDiv.setAttribute('data-pre-evolution-pokemon', form.pre_evolution_pokemon || '');
        arrowDiv.setAttribute('data-pre-evolution-form', form.pre_evolution_form_suffix || '');
        pokemonDiv.appendChild(arrowDiv);
      }

      formsColumn.appendChild(pokemonDiv);
    });

    levelDiv.appendChild(formsColumn);
    diagramDiv.appendChild(levelDiv);
  });

  // 모든 pokemon-sprite 요소에 애니메이션 적용
  diagramDiv.querySelectorAll('.pokemon-sprite').forEach(sprite => {
    setupPokemonSprite(sprite);
  });

  // 화살표 그리기 (모든 레벨이 렌더링된 후)
  // setTimeout(() => {
  //   drawEvolutionArrows(diagramDiv, formIndexMap);
  // }, 100);

}

// 초기화: 페이지 로드 시 세션 확인 및 auth 상태 변경 처리
function setLoggedInUI(user) {
  authMessage.textContent = user?.email ? `${user.email}로 로그인됨` : "로그인 상태";
  authDiv.style.display = "none";
  contentDiv.style.display = "flex";

  // 로그인 상태일 때 자시안 표시
  showSpecificPokemon("ZACIAN", "", "자시안");

  // 주간 날짜 범위 계산
  updateWeekRanges();

  // 어제 날짜 설정
  setYesterdayDate();

  // 아이콘 컬렉션 자동 로드
  loadUserPokemonIcons();
}

function setLoggedOutUI() {
  authMessage.textContent = "";
  authDiv.style.display = "flex";
  document.body.style.overflow = 'hidden';
  contentDiv.style.display = "none";

  document.getElementById('iconCollectionGrid').innerHTML = "";
}



// Firebase Auth handles authentication state via onAuthStateChanged above
// No need for separate initAuth function

// 모달 닫기
const detailClose = document.getElementById("detail-close");
const detailModal = document.getElementById("detail-modal");
if (detailClose && detailModal) {
  detailClose.addEventListener("click", () => {
    detailModal.style.display = "none";
  });
}

// 진화도 모달 닫기
const evolutionClose = document.getElementById("evolution-close");
const evolutionModal = document.getElementById("evolution-modal");
if (evolutionClose && evolutionModal) {
  evolutionClose.addEventListener("click", () => {
    evolutionModal.style.display = "none";
    document.body.style.overflow = ''; // 배경 스크롤 복원
    onModalClose();
  });
}

// 즐겨찾기 토글 버튼
const favoriteBtn = document.getElementById("favorite-btn");
if (favoriteBtn) {
  favoriteBtn.addEventListener("click", async () => {
    try {
      // const { data: userData } = await supabaseClient.auth.getUser();
      const userData = { user: currentUserId ? { id: currentUserId } : null };
      if (!userData?.user) {
        showToast('로그인이 필요합니다.');
        return;
      }

      const pokemonStableId = favoriteBtn.dataset.pokemonStableId;
      const isShiny = favoriteBtn.dataset.isShiny === 'true';

      if (!pokemonStableId) {
        showToast('포켓몬 정보를 찾을 수 없습니다.');
        return;
      }

      // 현재 즐겨찾기 상태 확인
      const { data: currentData, error: fetchError } = await supabaseClient
        .from('user_pokemon_collection')
        .select('is_favorite')
        .eq('user_id', userData.user.id)
        .eq('pokemon_stable_id', pokemonStableId)
        .eq('is_shiny', isShiny)
        .single();

      if (fetchError) {
        console.error('즐겨찾기 상태 조회 실패:', fetchError);
        showToast('즐겨찾기 상태를 확인할 수 없습니다.');
        return;
      }

      const newFavoriteState = !currentData.is_favorite;

      // 백엔드 함수 호출
      // TODO: Implement toggle_favorite via local API
      // const { data, error } = await supabaseClient.rpc('toggle_favorite_pokemon', ...);
      console.log('즐겨찾기 토글 기능은 현재 비활성화되어 있습니다.');
      showToast('즐겨찾기 기능은 현재 준비 중입니다.');
    } catch (err) {
      console.error('즐겨찾기 토글 중 예외 발생:', err);
      showToast('즐겨찾기 설정 중 오류가 발생했습니다.');
    }
  });
}
// 스프라이트 정보 저장 객체
// const spriteData = {}; // 이미 위에 선언됨

// PNG 이미지 로드하여 프레임 수 계산 및 애니메이션 설정
function setupSprite(spriteId, imageUrl, animationSpeed = 2) {
  const sprite = document.getElementById(spriteId);

  if (!sprite) return;

  // imageUrl이 null이거나 비어있으면 스프라이트를 숨기고 종료
  if (!imageUrl) {
    sprite.style.display = 'none';
    console.log(`✗ ${spriteId}: 이미지 URL이 없습니다.`);
    return;
  }

  // 유효한 URL인 경우 스프라이트 표시
  sprite.style.display = '';

  const img = new Image();
  img.onload = () => {
    const height = img.naturalHeight;
    const width = img.naturalWidth;

    // 프레임 수 계산: 가로 / 세로
    const frames = Math.max(1, Math.round(width / height));  // 최소 1프레임 보장

    // pokemon-flipper의 크기를 이미지 한 프레임 크기로 설정
    // const flipper = document.getElementById('pokemonFlipper');
    // if (flipper) {
    //   flipper.style.width = height + 'px';
    //   flipper.style.height = height + 'px';
    // }

    // 1프레임 이미지는 애니메이션 없이 정적 표시
    if (frames === 1) {
      sprite.style.width = height + 'px';
      sprite.style.height = height + 'px';
      sprite.style.backgroundSize = `auto ${height}px`;
      sprite.style.backgroundImage = `url("${imageUrl}")`;
      sprite.style.backgroundPosition = '0 0';
      sprite.style.opacity = '1'; // 이미지 로드 완료 후 표시

      console.log(`✓ ${spriteId}: 정적 이미지 (${width}×${height}px)`);
      return;
    }

    // Pokemon Essentials / RPG Maker 방식의 속도 계산 로직 적용
    // 공식: ((speed / 2) * delay) / 1000
    // speed: 애니메이션 속도 (Normal = 2, Fast = 1)
    // delay: 프레임 딜레이 (기본값 90, 빠르게 하려면 60, 30 등으로 감소)
    const ANIMATION_FRAME_DELAY = 90; // 60 -> 0.06s/frame (약 16fps)
    const SPRITE_SPEED = animationSpeed; // 전달받은 속도 사용 (기본값 2)

    let timePerFrame = ((SPRITE_SPEED / 2) * ANIMATION_FRAME_DELAY) / 1000;

    // 프레임 수에 비례한 duration 계산 (프레임당 일정 시간)
    const duration = frames * timePerFrame;

    // 스프라이트 데이터 저장
    spriteData[spriteId] = {
      frames: frames,
      width: width,
      height: height,
      duration: duration,
      timePerFrame: timePerFrame,
      frameSize: height
    };

    // CSS 동적 생성
    const styleId = `sprite-style-${spriteId}`;
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const animName = `sprite-anim-dynamic-${spriteId}`;
    styleEl.textContent = `
        @keyframes ${animName} {
          from { background-position: 0 0; }
          to { background-position: -${width}px 0; }
        }
      `;

    // 스프라이트 크기를 이미지 세로 크기에 맞춰 설정 (배틀필드와 동일)
    sprite.style.width = height + 'px';
    sprite.style.height = height + 'px';
    sprite.style.backgroundSize = `auto ${height}px`;
    sprite.style.backgroundImage = `url("${imageUrl}")`;
    sprite.style.animation = `${animName} ${duration}s steps(${frames}) infinite`;

    // Add transition class and trigger reflow
    sprite.classList.add('pokemon-sprite-image');
    requestAnimationFrame(() => {
      sprite.classList.add('loaded');
      sprite.style.opacity = '1'; // 이미지 로드 완료 후 표시
    });

    console.log(`✓ ${spriteId}: ${frames} 프레임, ${width}×${height}px, ${duration.toFixed(1)}초 (프레임당 ${timePerFrame}초)`);
  };

  img.onerror = () => {
    console.error(`이미지 로드 실패: ${imageUrl}`);
  };

  img.src = imageUrl;
}

// 포켓몬 스프라이트 설정 함수
function setupPokemonSprite(sprite) {
  const imageUrl = sprite.dataset.src;

  // 초기 상태: 투명하게 설정하여 로딩 중 깜빡임 방지
  sprite.style.opacity = '0';
  sprite.style.transition = 'opacity 0.2s ease';

  const img = new Image();
  img.onload = () => {
    const width = img.naturalWidth;
    const height = img.naturalHeight;

    // 프레임 수 계산: 가로 / 세로
    const frames = Math.round(width / height);

    // 애니메이션 시간 (적정 속도)
    const duration = 1; // 1초에 한 번 반복

    // 랜덤 딜레이 추가 (0~1.5초 사이)
    const randomDelay = Math.random() * duration;

    // CSS 동적 생성
    const animName = `pokemon-sprite-anim-${Math.random().toString(36).substr(2, 9)}`;
    const bounceAnimName = `pokemon-sprite-bounce-${Math.random().toString(36).substr(2, 9)}`;
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        @keyframes ${animName} {
          from { background-position: 0 0; }
          to { background-position: 0 0; }
        }
        @keyframes ${bounceAnimName} {
          0%, 100% { transform: translateY(0px); }
          12.5% { transform: translateY(-0.5px); }
          25% { transform: translateY(-1px); }
          37.5% { transform: translateY(-0.5px); }
          50% { transform: translateY(0px); }
          62.5% { transform: translateY(0.5px); }
          75% { transform: translateY(1px); }
          87.5% { transform: translateY(0.5px); }
        }
      `;
    document.head.appendChild(styleEl);

    // 스프라이트 설정 (컨테이너 크기에 맞춰 스케일 조정)
    const containerHeight = sprite.offsetHeight || 48; // 컨테이너 높이 (기본값)

    // 스타일 적용
    sprite.style.width = containerHeight + 'px';
    sprite.style.height = containerHeight + 'px';
    sprite.style.backgroundSize = `auto ${containerHeight}px`;
    // 중요: img.src를 사용하여 리다이렉트되거나 대체된 실제 이미지 URL을 사용
    sprite.style.backgroundImage = `url("${img.src}")`;
    sprite.style.backgroundPosition = '0 0'; // 명시적으로 첫 프레임 위치 고정
    sprite.style.backgroundRepeat = 'no-repeat';

    // 애니메이션 적용 (미보유 포켓몬은 애니메이션 제외)
    const isNotOwned = sprite.closest('.evolution-pokemon.not-owned');

    if (!isNotOwned) {
      sprite.style.animation = `${animName} ${duration}s steps(${frames}) infinite ${randomDelay}s, ${bounceAnimName} ${duration}s linear infinite ${randomDelay}s`;
    } else {
      sprite.style.animation = 'none';
      // 첫 프레임만 보여줌
      sprite.style.backgroundPosition = '0 0';
    }

    // 로딩 완료 후 표시
    requestAnimationFrame(() => {
      sprite.style.opacity = '1';
    });

    // console.log(`✓ 포켓몬 스프라이트 로드 완료: ${width}×${height}px`);
  };

  img.onerror = () => {
    // console.warn(`포켓몬 스프라이트 이미지 로드 실패: ${imageUrl}, 대체 이미지 시도 중...`);
    // Fallback: data-fallback 속성이 있으면 getPokemonImageUrl로 재시도
    const fallbackImage = sprite.getAttribute('data-fallback-image');
    const fallbackSuffix = sprite.getAttribute('data-fallback-suffix');

    // 이미 대체 이미지를 시도했는데도 실패했다면 중단 (무한루프 방지)
    if (fallbackImage && img.src.includes(fallbackImage) && (!fallbackSuffix || img.src.includes(fallbackSuffix))) {
      // 이미 fallback 시도함.
      sprite.style.opacity = '1'; // 빈 박스라도 표시
      return;
    }

    if (fallbackImage) {
      const fallbackUrl = getPokemonImageUrl(fallbackImage, fallbackSuffix || '', 'icon', false);
      // 재시도: img.src를 변경하면 다시 로드를 시도하고, 성공 시 onload가 호출됨
      img.src = fallbackUrl;
    } else {
      // console.error(`포켓몬 스프라이트 대체 이미지 없음`);
      sprite.style.opacity = '1'; // 실패해도 보이게 함 (빈 박스라도)
    }
  };

  img.src = imageUrl;
}

function changeSpeed(id, multiplier) {
  const sprite = document.getElementById(id);
  const data = spriteData[id];

  if (!data) return;

  const newSpeed = data.duration * multiplier;
  const animName = `sprite-anim-dynamic-${id}`;

  sprite.style.animation = `${animName} ${newSpeed}s steps(${data.frames}) infinite`;
}

// 양쪽 포켓몬 동시 제어 함수
function toggleBothAnimations() {
  toggleAnimation('sprite-back');
  toggleAnimation('sprite-front');
}

function changeBothSpeed(multiplier) {
  changeSpeed('sprite-back', multiplier);
  changeSpeed('sprite-front', multiplier);
}

// 드래그 회전 기능
let isDragging = false;
let startX = 0;
let currentRotation = 0;
let lastTouchTime = 0;
let touchIdentifier = null; // 터치 포인트 추적

// 플리퍼를 정면으로 초기화하는 함수 (부드러운 회전)
function resetFlipperToFront() {
  const flipper = document.getElementById('pokemonFlipper');
  if (!flipper) return;

  // 현재 회전값에서 가장 가까운 정면(360도의 배수) 계산
  // 예: 180 -> 360 (또는 0), -180 -> -360 (또는 0)
  const targetRotation = Math.round(currentRotation / 360) * 360;

  // 변화가 필요할 때만 애니메이션
  if (currentRotation !== targetRotation) {
    currentRotation = targetRotation;
    flipper.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'; // 부드러운 회전
    flipper.style.transform = `translate(-50%, -50%) rotateY(${targetRotation}deg)`;

    setTimeout(() => {
      flipper.style.transition = '';
    }, 600);
  }
}

// 가장 가까운 면으로 스냅하는 함수 (무한 회전 지원)
function snapToNearestFace() {
  const flipper = document.getElementById('pokemonFlipper');
  if (!flipper) return;

  // 현재 회전각에서 가장 가까운 180도 배수로 스냅
  // 0, 180, 360, 540, ... 또는 -180, -360, ...
  const targetRotation = Math.round(currentRotation / 180) * 180;

  currentRotation = targetRotation;
  flipper.style.transition = 'transform 0.4s ease-out';
  flipper.style.transform = `translate(-50%, -50%) rotateY(${targetRotation}deg)`;

  setTimeout(() => {
    flipper.style.transition = '';
  }, 400);
}

// 터치 이벤트 초기화 함수
function initTouchEvents() {
  const flipper = document.getElementById('pokemonFlipper');
  if (!flipper) {
    console.warn('pokemonFlipper element not found');
    return;
  }

  // 마우스 이벤트
  flipper.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    flipper.style.transition = ''; // 드래그 중엔 transition 제거
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    const rotationChange = deltaX * 1.5; // 1.5회전 민감도 조절 (더 민감하게)

    currentRotation += rotationChange;
    flipper.style.transform = `translate(-50%, -50%) rotateY(${currentRotation}deg)`;

    startX = e.clientX;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      snapToNearestFace(); // 드래그 종료 시 자동 스냅
    }
  });

  // 터치 이벤트 (모바일 지원) - 개선된 버전
  flipper.addEventListener('touchstart', (e) => {
    // 첫 번째 터치만 추적
    if (e.touches.length === 1) {
      isDragging = true;
      const touch = e.touches[0];
      touchIdentifier = touch.identifier;
      startX = touch.clientX;
      lastTouchTime = Date.now();
      flipper.style.transition = '';

      // 포켓몬 영역에서만 스크롤 방지
      e.preventDefault();
      e.stopPropagation();
    }
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    if (!isDragging || touchIdentifier === null) return;

    // 동일한 터치 포인트 찾기
    const touch = Array.from(e.touches).find(t => t.identifier === touchIdentifier);
    if (!touch) return;

    // 쓰로틀링: 16ms(60fps) 간격으로만 처리
    const now = Date.now();
    if (now - lastTouchTime < 16) return;
    lastTouchTime = now;

    const deltaX = touch.clientX - startX;
    const rotationChange = deltaX * 0.5;

    // requestAnimationFrame으로 부드러운 렌더링
    requestAnimationFrame(() => {
      currentRotation += rotationChange;
      flipper.style.transform = `translate(-50%, -50%) rotateY(${currentRotation}deg)`;
    });

    startX = touch.clientX;

    // 회전 중에는 스크롤 방지
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('touchend', (e) => {
    if (!isDragging) return;

    // 추적 중인 터치가 종료되었는지 확인
    const touchStillActive = Array.from(e.touches).some(t => t.identifier === touchIdentifier);

    if (!touchStillActive) {
      isDragging = false;
      touchIdentifier = null;
      snapToNearestFace(); // 터치 종료 시 자동 스냅
    }
  });

  document.addEventListener('touchcancel', () => {
    if (isDragging) {
      isDragging = false;
      touchIdentifier = null;
      snapToNearestFace();
    }
  });
}

// 페이지 로드 후 터치 이벤트 초기화
window.addEventListener('DOMContentLoaded', () => {
  initTouchEvents();
  setupSettingsListeners();

  // PWA 아이콘 동적 설정 (apple-touch-icon, PWA 배너 이미지 등)
  const appleTouchIcon = document.getElementById('apple-touch-icon');
  const pwaIconImg = document.getElementById('pwa-icon-img');

  if (appleTouchIcon) {
    appleTouchIcon.href = IMAGE_URLS.PWA_ICON_192;
  }

  if (pwaIconImg) {
    pwaIconImg.src = IMAGE_URLS.PWA_ICON_192;
  }

  // 이미지 URL 설정
  const eggSystemIcon = document.getElementById('eggSystemIcon');
  const ovalCharmIcon = document.getElementById('ovalCharmIcon');

  if (eggSystemIcon) {
    eggSystemIcon.src = IMAGE_URLS.EGG_ICON;
  }

  if (ovalCharmIcon) {
    ovalCharmIcon.src = IMAGE_URLS.OVAL_CHARM;
  }

  // 내 포켓몬 아이콘 표시 (기존 테스트 아이콘 로직은 loadUserPokemonIcons 함수로 이동됨)
  loadUserPokemonIcons();
});

// ==========================================
// 알 시스템 (Egg System) 로직
// ==========================================

const eggModal = document.getElementById('egg-modal');
const eggCloseBtn = document.getElementById('egg-close');
const eggSystemBtn = document.getElementById('eggSystemBtn');
const incubatorSlots = document.getElementById('incubator-slots');
const eggSearchInput = document.getElementById('egg-search-input');
const eggSearchBtn = document.getElementById('egg-search-btn');
const eggSearchResults = document.getElementById('egg-search-results');
const userCharmCount = document.getElementById('user-charm-count');

// API 엔드포인트 (실제 배포 시 수정 필요)
// 로컬 테스트나 Netlify/AWS Lambda 경로에 맞춰 설정하세요.
// API 엔드포인트 (Global API_BASE_URL 사용)

// 모달 열기/닫기
if (eggSystemBtn) {
  eggSystemBtn.addEventListener('click', () => {
    openEggModal();
  });
}

if (eggCloseBtn) {
  eggCloseBtn.addEventListener('click', () => {
    eggModal.style.display = 'none';
    document.body.style.overflow = ''; // 배경 스크롤 복원
    onModalClose();
  });
}

// 모달 외부 클릭 시 닫기
window.addEventListener('click', (e) => {
  if (e.target === eggModal) {
    eggModal.style.display = 'none';
    document.body.style.overflow = ''; // 배경 스크롤 복원
    onModalClose();
  }
  if (e.target === evolutionModal) {
    evolutionModal.style.display = 'none';
    document.body.style.overflow = ''; // 배경 스크롤 복원
    onModalClose();
  }
  if (e.target === detailModal) {
    detailModal.style.display = 'none';
  }
});

async function openEggModal() {
  eggModal.style.display = 'block';
  document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
  onModalOpen();
  await loadUserEggs();
}

// 사용자 알 목록 및 부적 개수 로드
async function loadUserEggs() {
  try {
    if (!currentUserId) {
      console.log('비로그인 상태: 알 시스템 데모 데이터 사용 안함');
      renderIncubators([], 0);
      return;
    }

    // 실제 API 호출
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/eggs`, { headers });
      if (!response.ok) throw new Error('API Error');

      const result = await response.json();
      if (result.success) {
        renderIncubators(result.data.eggs, result.data.round_charms);
      } else {
        throw new Error(result.error || 'Unknown error');
      }

    } catch (apiError) {
      console.error('API 호출 실패:', apiError);
      // 에러 시 빈 상태 표시
      renderIncubators([], 0);
    }

  } catch (err) {
    console.error('Error loading eggs:', err);
  }
}

// 부화기 렌더링
function renderIncubators(eggs, charms) {
  const containers = [
    document.getElementById('incubator-slots'),
    document.getElementById('incubator-slots-modal')
  ];

  const charmCounters = [
    document.getElementById('user-charm-count'),
    document.getElementById('user-charm-count-modal')
  ];

  charmCounters.forEach(el => {
    if (el) el.textContent = charms;
  });

  containers.forEach(container => {
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < 3; i++) {
      const egg = eggs.find(e => e.slot_index === i);
      const slotDiv = document.createElement('div');
      slotDiv.className = `incubator-slot ${egg ? 'occupied' : 'empty'}`;

      if (egg) {
        // 서버 데이터 기준 부화 여부 판단 (클라이언트 시계 의존성 제거)
        const isHatched = egg.is_hatched || (egg.remaining_seconds !== undefined && egg.remaining_seconds <= 0);

        const eggImg = document.createElement('img');
        eggImg.src = `${ASSETS_BASE_URL}/base/img/Eggs/000.png`;
        eggImg.className = 'egg-img';

        slotDiv.appendChild(eggImg);

        const timerDiv = document.createElement('div');
        timerDiv.className = 'egg-timer';

        if (isHatched) {
          timerDiv.textContent = '부화 가능!';
          timerDiv.style.color = '#2f855a';
          timerDiv.style.background = '#c6f6d5';
          slotDiv.style.cursor = 'pointer';
          slotDiv.style.borderColor = '#48bb78';
          slotDiv.onclick = () => handleHatch(egg);
          eggImg.style.animation = 'bounce 1s infinite';
        } else {
          // 남은 시간 계산 및 실시간 카운트다운
          let currentRemaining = egg.remaining_seconds || 0;

          const updateTimer = () => {
            if (currentRemaining <= 0) {
              timerDiv.textContent = '부화 가능!';
              timerDiv.style.color = '#2f855a';
              timerDiv.style.background = '#c6f6d5';
              slotDiv.style.cursor = 'pointer';
              slotDiv.style.borderColor = '#48bb78';
              slotDiv.onclick = () => handleHatch(egg);
              eggImg.style.animation = 'bounce 1s infinite';

              // 타이머 정지
              if (timerDiv.intervalId) clearInterval(timerDiv.intervalId);
              return;
            }

            const hours = Math.floor(currentRemaining / 3600);
            const mins = Math.floor((currentRemaining % 3600) / 60);
            const secs = Math.floor(currentRemaining % 60);

            if (hours === 0 && mins === 0) {
              timerDiv.textContent = `${secs}초`;
            } else {
              timerDiv.textContent = `${hours}시간 ${mins}분`;
            }

            currentRemaining--;
          };

          updateTimer(); // 즉시 실행

          // 1초마다 갱신
          const intervalId = setInterval(updateTimer, 1000);
          timerDiv.intervalId = intervalId; // 나중에 정리하기 위해 저장 (페이지 이동 시 등)
        }
        slotDiv.appendChild(timerDiv);

        // 포켓몬 이름 (옵션)
        const nameDiv = document.createElement('div');
        nameDiv.style.fontSize = '10px';
        nameDiv.style.marginTop = '4px';
        nameDiv.style.color = '#718096';
        nameDiv.textContent = egg.pokemon_name;
        slotDiv.appendChild(nameDiv);

      } else {
        const emptyImg = document.createElement('img');
        emptyImg.src = `${ASSETS_BASE_URL}/base/img/Eggs/000.png`;
        emptyImg.className = 'egg-img';
        emptyImg.style.filter = 'grayscale(100%)';
        emptyImg.style.opacity = '0.5';
        slotDiv.appendChild(emptyImg);

        const textDiv = document.createElement('div');
        textDiv.className = 'egg-timer';
        textDiv.textContent = '빈 슬롯';
        textDiv.style.background = 'transparent';
        textDiv.style.color = '#a0aec0';
        slotDiv.appendChild(textDiv);
      }

      container.appendChild(slotDiv);
    }
  });
}

// 검색 로직
if (eggSearchBtn) {
  eggSearchBtn.addEventListener('click', () => searchEggs());
}
if (eggSearchInput) {
  eggSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchEggs();
  });
}

async function searchEggs() {
  const searchInput = document.getElementById('egg-search-input');
  const resultsContainer = document.getElementById('egg-search-results');

  if (!searchInput || !resultsContainer) {
    console.error('Egg search elements not found');
    return;
  }

  const query = searchInput.value.trim();
  if (!query) return;

  resultsContainer.innerHTML = '<div style="padding:10px; text-align:center;">🥚 알을 찾는 중...</div>';

  try {
    // 실제 API 호출
    const headers = await getAuthHeaders();
    // 보안: userId는 백엔드에서 인증 토큰으로부터 추출 (클라이언트에서 전달하지 않음)
    const response = await fetch(`/api/eggs/search?query=${encodeURIComponent(query)}`, { headers });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      renderEggSearchResults(result.data, resultsContainer);
    } else {
      throw new Error(result.error);
    }

  } catch (err) {
    console.error(err);
    resultsContainer.innerHTML = '<div style="padding:10px; color:red; text-align:center;">오류가 발생했습니다.</div>';
  }
}

function renderEggSearchResults(results, container) {
  const resultsContainer = container || document.getElementById('egg-search-results');
  if (!resultsContainer) {
    console.error('Egg search results container not found');
    return;
  }

  resultsContainer.innerHTML = '';
  if (results.length === 0) {
    resultsContainer.innerHTML = '<div style="padding:10px; text-align:center; color:#718096;">검색 결과가 없습니다.<br><small>포켓몬 이름을 정확히 입력해주세요.</small></div>';
    return;
  }

  results.forEach(pokemon => {
    const item = document.createElement('div');
    item.className = 'egg-result-item';

    // 이미 보유했거나 알이 있는 경우 체크
    const isDisabled = pokemon.has_pokemon || pokemon.has_egg;
    const statusText = pokemon.has_pokemon ? '보유중' : (pokemon.has_egg ? '알 보유중' : '');

    // 아이콘은 pokemon-sprite로 렌더링
    item.innerHTML = `
      <div class="pokemon-sprite ${isDisabled ? 'grayscale' : ''}" data-src="${getPokemonImageUrl(pokemon.image_name, '', 'icon')}" data-fallback-image="${pokemon.image_name}" data-fallback-suffix=""></div>
      <div class="egg-result-info">
        <div class="egg-result-name">${pokemon.name}</div>
        <div class="egg-result-time">⏳ ${pokemon.hatch_hours}시간 후 부화</div>
        ${statusText ? `<div class="egg-result-status">${statusText}</div>` : ''}
      </div>
      <button class="acquire-btn ${isDisabled ? 'disabled' : ''}" ${isDisabled ? 'disabled' : ''}>${isDisabled ? '획득불가' : '선택'}</button>
    `;

    // 버튼에 직접 이벤트 리스너 추가 (비활성화된 경우 제외)
    const btn = item.querySelector('.acquire-btn');
    if (btn && !isDisabled) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // 부모 요소로의 이벤트 전파 방지
        console.log('알 선택 버튼 클릭됨:', pokemon.name);
        confirmAcquireEgg(pokemon);
      });
    }

    // 아이템 전체 클릭 시에도 동작하도록 (비활성화된 경우 제외)
    if (!isDisabled) {
      item.addEventListener('click', () => {
        console.log('알 아이템 클릭됨:', pokemon.name);
        confirmAcquireEgg(pokemon);
      });
    } else {
      item.style.cursor = 'not-allowed';
      item.style.opacity = '0.6';
    }

    resultsContainer.appendChild(item);
  });

  // 모든 pokemon-sprite에 애니메이션 적용
  resultsContainer.querySelectorAll('.pokemon-sprite').forEach(sprite => {
    setupPokemonSprite(sprite);
  });
}

// 커스텀 확인 모달 로직
const confirmModal = document.getElementById('confirm-modal');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmOkBtn = document.getElementById('confirm-ok-btn');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

let currentConfirmResolve = null;

// showConfirmModal 중복 정의 제거됨 (아래 통합 버전 사용)

async function confirmAcquireEgg(pokemon) {
  console.log('confirmAcquireEgg 함수 호출됨:', pokemon);

  // 현재 보유량 가져오기
  const charmCount = parseInt(userCharmCount.textContent || '0');
  const cost = 1;

  // 포켓몬 아이콘 URL
  const iconUrl = getPokemonImageUrl(pokemon.stable_id, '', 'icon', false);

  const confirmed = await showConfirmModal(
    '알 획득',
    `<div style="text-align: center;">    
      <strong style="font-size: 18px;">${pokemon.name}</strong> 알을 가져오시겠습니까?<br><br>
      <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin:10px 0;">
        <img src="${IMAGE_URLS.OVAL_CHARM}" width="32" height="32">
        <span>소모: 둥근부적 <strong>${cost}개</strong></span>
      </div>
      <small style="color:#666">(보유: ${charmCount}개)</small>
    </div>`
  );

  console.log('모달 결과:', confirmed);

  if (confirmed) {
    console.log('acquireEgg 호출 시작');
    await acquireEgg(pokemon);
  }
}

async function acquireEgg(pokemon) {
  // 게스트 모드 체크
  if (window.isGuest()) {
    showToast('체험 모드에서는 알을 획득할 수 없습니다.');
    return;
  }

  // 둥근부적 확인 (UI 상태 기반)
  const currentCharms = parseInt(userCharmCount.textContent || '0');

  if (currentCharms < 1) {
    showToast('❌ 둥근부적이 부족합니다!');
    return;
  }

  // 슬롯 확인
  const occupied = document.querySelectorAll('.incubator-slot.occupied').length;
  if (occupied >= 3) {
    showToast('❌ 알 슬롯이 가득 찼습니다!');
    return;
  }

  // API 호출
  try {
    if (!currentUserId) {
      showToast('로그인이 필요합니다.');
      return;
    }

    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/eggs/acquire`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        pokemonStableId: pokemon.stable_id
      })
    });

    const result = await response.json();

    if (result.success) {
      // 성공 시 UI 업데이트
      userCharmCount.textContent = result.data.remaining_charms;
      showToast(result.data.message);

      // 검색 결과 및 입력 초기화
      if (eggSearchInput) eggSearchInput.value = '';
      if (eggSearchResults) eggSearchResults.innerHTML = '';

      // 알 목록 새로고침
      await loadUserEggs();
    } else {
      throw new Error(result.error || '알 획득 실패');
    }

  } catch (err) {
    console.error("Egg acquire error:", err);
    showToast(err.message || '오류가 발생했습니다.');
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.8)',
    color: 'white',
    padding: '12px 24px',
    borderRadius: '30px',
    zIndex: '3000',
    fontSize: '14px',
    fontWeight: 'bold',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    transition: 'opacity 0.3s',
    whiteSpace: 'nowrap',
    minWidth: '300px',
    textAlign: 'center'
  });

  document.body.appendChild(toast);

  // 애니메이션
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}



async function handleHatch(egg) {
  console.log('handleHatch 호출됨:', egg);

  // 사용자 ID 재확인 및 동기화 시도
  if (!currentUserId) {
    const user = firebase.auth().currentUser;
    if (user) {
      console.log('currentUserId 없음. Firebase 유저로 동기화 시도:', user.uid);
      showToast('⏳ 사용자 정보를 동기화 중입니다...');

      try {
        // 동기화 요청 직접 수행
        const idToken = await user.getIdToken();
        const syncResponse = await fetch(`${API_BASE_URL}/auth/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            idToken: idToken,
            email: user.email,
            username: user.displayName
          })
        });

        const syncData = await syncResponse.json();
        if (syncData && syncData.success) {
          currentUserId = syncData.data;
          console.log('동기화 성공, currentUserId:', currentUserId);
        } else {
          throw new Error('동기화 실패');
        }
      } catch (e) {
        console.error('동기화 중 오류:', e);
        showToast('❌ 사용자 정보 동기화에 실패했습니다. 새로고침 해주세요.');
        return;
      }
    } else {
      showToast('❌ 로그인이 필요합니다.');
      return;
    }
  }

  // 한 번 더 확인
  if (!currentUserId) {
    showToast('❌ 사용자 정보를 불러올 수 없습니다.');
    return;
  }

  const confirmed = await showConfirmModal(
    '알 부화',
    `<strong>${egg.pokemon_name}</strong> 알을 부화시키겠습니까?`
  );

  if (!confirmed) return;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/eggs/hatch', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        // userId extracted from token
        eggId: egg.egg_id
      })
    });

    const result = await response.json();

    if (result.success) {
      // 성공 메시지 표시
      showToast(result.data.message);

      // 알 목록 새로고침
      await loadUserEggs();

      // 컬렉션도 새로고침 (새 포켓몬인 경우)
      if (result.data.is_new) {
        // 내 포켓몬 아이콘 새로고침
        if (typeof loadUserPokemonIcons === 'function') {
          loadUserPokemonIcons();
        }
      }

      // 홈 탭으로 자동 이동
      const homeTabItem = document.querySelector('.tab-item[data-tab="home"]');
      if (homeTabItem) {
        homeTabItem.click();
      }
    } else {
      throw new Error(result.error || '부화 실패');
    }

  } catch (err) {
    console.error('Hatch error:', err);
    showToast(`❌ ${err.message || '부화 중 오류가 발생했습니다.'}`);
  }
}

// CSS 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
`;
document.head.appendChild(style);

// ==========================================
// 설정 패널 (Settings Panel) 로직
// ==========================================

// 설정 화면 열기
function openSettings() {
  const panel = document.getElementById('settings-panel');
  if (panel) {
    panel.classList.remove('slide-hidden');
    panel.classList.add('slide-visible');
    // 뒤 화면 스크롤 방지
    document.body.style.overflow = 'hidden';
  }
}

// 설정 화면 닫기
function closeSettings() {
  const panel = document.getElementById('settings-panel');
  if (panel) {
    panel.classList.remove('slide-visible');
    panel.classList.add('slide-hidden');
    // 뒤 화면 스크롤 복원
    document.body.style.overflow = '';
  }
}

// 설정 리스너 초기화
function setupSettingsListeners() {
  const cryToggle = document.getElementById('cry-sound-toggle');
  if (cryToggle) {
    // 초기 상태 반영
    if (isCrySoundEnabled) {
      cryToggle.classList.add('active');
    } else {
      cryToggle.classList.remove('active');
    }

    cryToggle.addEventListener('click', () => {
      isCrySoundEnabled = !isCrySoundEnabled;
      localStorage.setItem('crySoundEnabled', isCrySoundEnabled);

      if (isCrySoundEnabled) {
        cryToggle.classList.add('active');
      } else {
        cryToggle.classList.remove('active');
      }
    });
  }
}

// 전역으로 함수 노출 (HTML onclick 속성에서 사용하기 위함)
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.showIconGroupDetail = showIconGroupDetail;

// ==========================================
// Info Modal 로직
// ==========================================

// 프로젝트 정보 모달 열기
function openInfoModal() {
  const modal = document.getElementById('info-modal');
  if (modal) {
    modal.style.display = 'block';
    document.body.classList.add('modal-open');
    onModalOpen();
    // 기본 탭으로 초기화
    switchInfoTab('overview');
  }
}

// 프로젝트 정보 모달 닫기
function closeInfoModal() {
  const modal = document.getElementById('info-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
    onModalClose();
  }
}

// 탭 전환 함수
function switchInfoTab(tabId) {
  // 모든 탭 버튼 비활성화
  document.querySelectorAll('.info-tab').forEach(tab => {
    tab.classList.remove('active');
  });

  // 모든 탭 콘텐츠 숨기기
  document.querySelectorAll('.info-tab-content').forEach(content => {
    content.classList.remove('active');
  });

  // 선택된 탭 활성화
  const selectedTab = document.querySelector(`.info-tab[data-tab="${tabId}"]`);
  const selectedContent = document.getElementById(`tab-${tabId}`);

  if (selectedTab) selectedTab.classList.add('active');
  if (selectedContent) selectedContent.classList.add('active');
}

// 아코디언 토글 함수
function toggleAccordion(accordionItem) {
  const isOpen = accordionItem.classList.contains('open');

  // 같은 그룹 내 다른 아코디언 닫기 (선택적)
  // const group = accordionItem.closest('.accordion-group');
  // group.querySelectorAll('.accordion-item.open').forEach(item => {
  //   if (item !== accordionItem) item.classList.remove('open');
  // });

  // 토글
  if (isOpen) {
    accordionItem.classList.remove('open');
  } else {
    accordionItem.classList.add('open');
  }
}

// Info Modal 이벤트 리스너 초기화
function initInfoModalListeners() {
  // 탭 클릭 이벤트
  document.querySelectorAll('.info-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      switchInfoTab(tabId);
    });
  });

  // 아코디언 헤더 클릭 이벤트
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const accordionItem = header.closest('.accordion-item');
      if (accordionItem) {
        toggleAccordion(accordionItem);
      }
    });
  });
}

// 전역으로 함수 노출
window.openInfoModal = openInfoModal;
window.closeInfoModal = closeInfoModal;

// info-modal 닫기 버튼 이벤트 리스너
const infoCloseBtn = document.getElementById('info-close');
if (infoCloseBtn) {
  infoCloseBtn.addEventListener('click', closeInfoModal);
}

// info-modal 외부 클릭 시 닫기
window.addEventListener('click', (e) => {
  const infoModal = document.getElementById('info-modal');
  if (e.target === infoModal) {
    closeInfoModal();
  }
});

// DOM 로드 시 이벤트 리스너 초기화
document.addEventListener('DOMContentLoaded', initInfoModalListeners);




// --- Evolution & Form Unlock Logic ---

// 확인 모달 표시 함수
// 확인 모달 표시 함수 (Promise & Callback 지원)
function showConfirmModal(title, message, onOpen = null) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    const okBtn = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');

    if (!modal || !titleEl || !msgEl || !okBtn || !cancelBtn) {
      // Fallback
      const result = confirm(message.replace(/<[^>]*>/g, ''));
      resolve(result);
      return;
    }

    titleEl.textContent = title;
    msgEl.innerHTML = message; // HTML 허용

    // 기존 리스너 제거를 위해 복제
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);

    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newOkBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      onModalClose();
      resolve(true);
    });

    newCancelBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      onModalClose();
      resolve(false);
    });

    modal.style.display = 'block';
    onModalOpen();

    // 모달이 열린 후 onOpen 콜백 실행
    if (onOpen) onOpen();
  });
}

// 사용자 아이템 조회
async function fetchUserItems() {
  if (!currentUserId) return {};
  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/user/items', { headers });
    if (!response.ok) return {};
    const result = await response.json();
    return result.data || {};
  } catch (e) {
    console.error("Failed to fetch items:", e);
    return {};
  }
}

// 실제 진화 API 호출
async function executeEvolution(currentId, targetId, cost, baseImageName) {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/pokemon/evolve', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        // userId extracted from token
        currentPokemonId: currentId,
        targetPokemonId: targetId,
        cost
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || `얼라리...? ${targetId}의 진화가 실패했다!`);
    }

    // 성공 시
    showToast(`${result.data.message}`);

    // 데이터 갱신
    await showIconGroupDetail(baseImageName, targetId);
    // 아이콘 목록도 갱신
    loadUserPokemonIcons();

  } catch (e) {
    showToast(e.message);
  }
}

// 포켓몬 진화 처리 (UI 호출용)
async function handleEvolutionClick(currentStableId, targetStableId, targetName, cost, baseImageName) {
  const items = await fetchUserItems();
  const candyCount = items['Rare Candy']?.quantity || 0;

  if (candyCount < cost) {
    showToast(`이상한 사탕이 부족합니다..!\n보유: ${candyCount}개 / 필요: ${cost}개`);
    return;
  }

  const confirmed = await showConfirmModal(
    '진화',
    `<strong>${targetName}</strong>(으)로 진화하시겠습니까?<br><br>
     <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin:10px 0;">
       <img src="${IMAGE_URLS.RARE_CANDY}" width="32" height="32">
       <span>소모: 이상한 사탕 <strong>${cost}개</strong></span>
     </div>
     <small style="color:#666">(보유: ${candyCount}개)</small>`
  );

  if (confirmed) {
    await executeEvolution(currentStableId, targetStableId, cost, baseImageName);
  }
}

// 폼 해제 처리 (UI 호출용)
async function handleFormUnlockClick(targetStableId, targetName, baseImageName, isRarePokemon = false) {
  const items = await fetchUserItems();
  const itemName = isRarePokemon ? 'Awakening Charm' : 'Mystic Charm';
  const itemNameKo = isRarePokemon ? '각성의 부적' : '신비의 부적';
  const itemImage = isRarePokemon ? IMAGE_URLS.AWAKENING_CHARM : IMAGE_URLS.MYSTIC_CHARM;

  const charmCount = items[itemName]?.quantity || 0;
  const cost = 1;

  if (charmCount < cost) {
    showToast(`${itemNameKo}이 부족합니다...!`);
    return;
  }

  const confirmed = await showConfirmModal(
    '폼 해제',
    `<strong>${targetName}</strong> 폼을 해제하시겠습니까?<br><br>
     <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin:10px 0;">
       <img src="${itemImage}" width="32" height="32">
       <span>소모: ${itemNameKo} <strong>${cost}개</strong></span>
     </div>
     <small style="color:#666">(보유: ${charmCount}개)</small>`
  );

  if (confirmed) {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/pokemon/unlock-form', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          // userId extracted from token
          targetFormId: targetStableId,
          baseImageName
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `얼라리...? ${targetName}의 폼 해제가 실패했다!`);
      }

      showToast(`${result.data.message}`);
      await showIconGroupDetail(baseImageName, targetStableId);
      loadUserPokemonIcons();

    } catch (e) {
      showToast(e.message);
    }
  }
}

// ============================================
// 약관 동의 및 스타터 포켓몬 시스템
// ============================================

// 약관 세부사항 토글
window.toggleTermsDetail = function (detailId) {
  const el = document.getElementById(detailId);
  if (el) {
    el.classList.toggle('show');
  }
};

// 전체 약관 동의/해제
window.toggleAllTerms = function () {
  const checkAll = document.getElementById('terms-check-all');
  const checkboxes = document.querySelectorAll('.terms-req-check');

  checkboxes.forEach(cb => {
    cb.checked = checkAll.checked;
  });

  checkTermsStatus();
};

// 약관 상태 확인 (버튼 활성화)
window.checkTermsStatus = function () {
  const checkboxes = document.querySelectorAll('.terms-req-check');
  const checkAll = document.getElementById('terms-check-all');
  const submitBtn = document.getElementById('terms-submit-btn');

  let allChecked = true;
  checkboxes.forEach(cb => {
    if (!cb.checked) allChecked = false;
  });

  // 전체 동의 체크박스 UI 동기화
  if (checkAll) {
    checkAll.checked = allChecked;
  }

  // 버튼 활성화/비활성화
  if (submitBtn) {
    if (allChecked) {
      submitBtn.disabled = false;
      submitBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      submitBtn.style.color = 'white';
      submitBtn.style.cursor = 'pointer';
      submitBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    } else {
      submitBtn.disabled = true;
      submitBtn.style.background = '#d1d5db';
      submitBtn.style.color = '#9ca3af';
      submitBtn.style.cursor = 'not-allowed';
      submitBtn.style.boxShadow = 'none';
    }
  }
};

// 약관 동의 거부 처리
async function handleTermsRefusal() {
  if (confirm('약관에 동의하지 않으면 서비스를 이용할 수 없습니다.\n정말 거부하시겠습니까?')) {
    try {
      // 로그아웃 처리
      if (window.firebaseAuth && window.firebaseSignOut) {
        await window.firebaseSignOut(window.firebaseAuth);
      }

      // 약관 모달 숨기기
      document.getElementById('terms-modal').style.display = 'none';
      onModalClose();

      // 로그인 화면 표시
      authDiv.style.display = "flex";
      contentDiv.style.display = "none";

      showToast('약관 동의가 거부되어 초기 화면으로 돌아갑니다.');
    } catch (error) {
      console.error('Refusal error:', error);
      showToast('오류가 발생했습니다.');
    }
  }
}

// 약관 동의 완료 처리 - 초기 스크린타임 입력 모달로 이동
async function completeTermsAgreement() {
  try {
    // 약관 모달 숨기기
    document.getElementById('terms-modal').style.display = 'none';
    // terms 모달은 닫지만 initial-screentime 모달이 바로 열리므로 onModalClose 호출 안함

    // 초기 스크린타임 입력 모달 표시
    showInitialScreenTimeModal();

  } catch (error) {
    console.error('Terms agreement error:', error);
    showToast('약관 동의 처리 중 오류가 발생했습니다: ' + error.message);
  }
}

// 초기 스크린타임 입력 모달 표시
function showInitialScreenTimeModal() {
  const modal = document.getElementById('initial-screentime-modal');
  if (modal) {
    modal.style.display = 'flex';
    // onModalOpen 호출 안함: terms-modal에서 연속으로 열리므로 이미 열린 상태
    // 입력 필드 초기화
    document.getElementById('initialScreenTimeHours').value = '';
    document.getElementById('initialScreenTimeMinutes').value = '';
    document.getElementById('initialTimePreview').textContent = '-';
    document.getElementById('initial-screentime-submit-btn').disabled = true;
  }
}

// 초기 스크린타임 저장 및 완료 (입력 시)
async function submitInitialScreenTime() {
  const hoursInput = document.getElementById('initialScreenTimeHours');
  const minutesInput = document.getElementById('initialScreenTimeMinutes');

  const hours = parseInt(hoursInput.value) || 0;
  const minutes = parseInt(minutesInput.value) || 0;
  const totalMinutes = hours * 60 + minutes;

  if (totalMinutes <= 0 || totalMinutes > 1440) {
    showToast('올바른 스크린타임을 입력해주세요.');
    return;
  }

  try {
    // 약관 동의 + 초기 스크린타임 함께 저장
    const headers = await getAuthHeaders();
    const response = await fetch('/api/user/terms-agreement', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        agreed: true,
        initialScreenTimeMinutes: totalMinutes
      })
    });

    if (!response.ok) {
      throw new Error('저장 실패');
    }

    // 초기 스크린타임 모달 숨기기
    document.getElementById('initial-screentime-modal').style.display = 'none';
    // initial-screentime 모달은 닫지만 starter-welcome 모달이 바로 열리므로 onModalClose 호출 안함

    // 스타터 포켓몬 환영 모달 표시
    await showStarterWelcomeModal();

  } catch (error) {
    console.error('Initial screen time save error:', error);
    showToast('저장 중 오류가 발생했습니다: ' + error.message);
  }
}

// 초기 스크린타임 입력 시간 미리보기 업데이트
function updateInitialTimePreview() {
  const hoursInput = document.getElementById('initialScreenTimeHours');
  const minutesInput = document.getElementById('initialScreenTimeMinutes');
  const preview = document.getElementById('initialTimePreview');
  const submitBtn = document.getElementById('initial-screentime-submit-btn');

  const hours = parseInt(hoursInput.value) || 0;
  const minutes = parseInt(minutesInput.value) || 0;
  const totalMinutes = hours * 60 + minutes;

  if (hours > 0 || minutes > 0) {
    let previewText = '';
    if (hours > 0) previewText += `${hours}시간 `;
    if (minutes > 0) previewText += `${minutes}분`;
    preview.textContent = previewText.trim() || '-';

    // 유효한 입력이면 버튼 활성화
    if (totalMinutes > 0 && totalMinutes <= 1440) {
      submitBtn.disabled = false;
    } else {
      submitBtn.disabled = true;
    }
  } else {
    preview.textContent = '-';
    submitBtn.disabled = true;
  }
}

// 스타터 포켓몬 환영 모달 표시
async function showStarterWelcomeModal() {
  const modal = document.getElementById('starter-welcome-modal');

  // 데이터 로드 (아직 로드되지 않았거나 실패한 경우 재시도)
  await loadStarterPokemon();

  // 모달 표시
  modal.style.display = 'flex';
}

// 스타터 포켓몬 모달 닫기 및 메인 화면 표시
function closeStarterWelcomeModal() {
  document.getElementById('starter-welcome-modal').style.display = 'none';
  onModalClose(); // 마지막 온보딩 모달이 닫힐 때 theme-color 복원

  // 메인 콘텐츠 표시 및 초기 데이터 로드
  contentDiv.style.display = 'flex';
  loadUserPokemonIcons();
}

// 이벤트 리스너 설정
if (document.getElementById('terms-submit-btn')) {
  document.getElementById('terms-submit-btn').addEventListener('click', completeTermsAgreement);
}

if (document.getElementById('terms-refuse-btn')) {
  document.getElementById('terms-refuse-btn').addEventListener('click', handleTermsRefusal);
}

if (document.getElementById('starter-modal-close-btn')) {
  document.getElementById('starter-modal-close-btn').addEventListener('click', closeStarterWelcomeModal);
}

// 초기 스크린타임 입력 모달 이벤트 리스너
document.addEventListener('DOMContentLoaded', () => {
  // 시간/분 입력 필드 이벤트
  const hoursInput = document.getElementById('initialScreenTimeHours');
  const minutesInput = document.getElementById('initialScreenTimeMinutes');

  if (hoursInput) {
    hoursInput.addEventListener('input', updateInitialTimePreview);
    hoursInput.addEventListener('focus', () => hoursInput.select());
  }

  if (minutesInput) {
    minutesInput.addEventListener('input', updateInitialTimePreview);
    minutesInput.addEventListener('focus', () => minutesInput.select());
  }

  // 제출 버튼
  const submitBtn = document.getElementById('initial-screentime-submit-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', submitInitialScreenTime);
  }
});

// 약관 체크박스에 이벤트 리스너 추가
document.addEventListener('DOMContentLoaded', () => {
  const termsCheckAll = document.getElementById('terms-check-all');
  if (termsCheckAll) {
    termsCheckAll.addEventListener('change', function () {
      const checkboxes = document.querySelectorAll('.terms-req-check');
      checkboxes.forEach(cb => {
        cb.checked = this.checked;
      });
      checkTermsStatus();
    });
  }

  // 전체 동의 박스 클릭 처리 (체크박스/라벨 외 영역 클릭 시)
  const termsBox = document.querySelector('.terms-all-agree-box');
  if (termsBox) {
    termsBox.addEventListener('click', (e) => {
      // 체크박스나 라벨을 클릭한 경우는 브라우저가 알아서 처리하므로 무시
      if (e.target.type === 'checkbox' || e.target.closest('label')) return;

      const checkAll = document.getElementById('terms-check-all');
      if (checkAll) {
        checkAll.click(); // 체크박스 클릭 트리거 (onchange 이벤트 발생)
      }
    });
  }
});

// 스타터 포켓몬 로드 함수 (스타터 모달이 열릴 때 API에서 로드)
let starterPokemonLoaded = false;

async function loadStarterPokemon() {
  const starterGrid = document.getElementById('starter-pokemon-grid');
  if (!starterGrid) return;

  // 이미 로드되었으면 중복 로드 방지
  if (starterPokemonLoaded) return;

  // 로딩 표시
  starterGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #666;">포켓몬을 불러오는 중...</div>';

  try {
    // Guest API에서 스타터 포켓몬 데이터 로드
    const response = await fetch('/api/guest/starter-pokemon');
    if (!response.ok) throw new Error('Failed to fetch starter pokemon');

    const result = await response.json();
    const starterData = result.data || result;

    starterGrid.innerHTML = ''; // 초기화

    // 세대 순으로 정렬
    const sortedData = [...starterData].sort((a, b) => {
      if (a.generation !== b.generation) return a.generation - b.generation;
      return 0;
    });

    sortedData.forEach(pokemon => {
      const type1 = pokemon.type1;
      const type2 = pokemon.type2;
      const typeText = type2 ? `${type1}/${type2} 타입` : `${type1} 타입`;
      const typeClass = getTypeClass(type1);
      const generationText = `${pokemon.generation}세대`;

      const itemDiv = document.createElement('div');
      itemDiv.className = 'starter-pokemon-item';
      itemDiv.innerHTML = `
        <div class="starter-pokemon-visual ${typeClass}">
          <div class="starter-pokemon-image">
            <div class="sprite" data-src="${pokemon.front_image}"></div>
          </div>
        </div>
        <div class="starter-pokemon-info">
          <div class="starter-pokemon-name">${pokemon.name}</div>
          <div class="starter-pokemon-type">${generationText} ${typeText}</div>
        </div>
      `;

      starterGrid.appendChild(itemDiv);

      // 스프라이트 애니메이션 설정
      const spriteDiv = itemDiv.querySelector('.sprite');
      if (spriteDiv) {
        setupPokemonSprite(spriteDiv);
      }
    });

    starterPokemonLoaded = true;
  } catch (error) {
    console.error('Failed to load starter pokemon:', error);
    starterGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">포켓몬을 불러올 수 없습니다.</p>';
  }
}

// 스타터 모달이 열릴 때 로드 (DOMContentLoaded 대신)
document.addEventListener('DOMContentLoaded', () => {
  const starterModal = document.getElementById('starter-modal');
  if (starterModal) {
    // MutationObserver로 모달이 보여질 때 감지
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const display = starterModal.style.display;
          if (display === 'flex' || display === 'block') {
            loadStarterPokemon();
          }
        }
      });
    });
    observer.observe(starterModal, { attributes: true });
  }
});
// ... (Existing code from index.js) ...

// ==========================================
// 운동 관리 기능 (Moved from indexplus.js)
// ==========================================

// 운동 데이터 상태 관리
let muscleGroups = [];
let userExercises = [];
let weeklyProgress = [];

// API Base URL (Defined at top of file)
// const API_BASE_URL = '/api';

// API 호출 헬퍼
async function fetchAPI(endpoint, options = {}) {
  if (window.isGuest()) {
    // Guest Mode: POST/PUT/DELETE는 차단
    if (options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE') {
      throw new Error('체험 모드에서는 저장할 수 없습니다.');
    }

    // Guest Mode: GET 요청은 /api/guest 엔드포인트로 리다이렉트
    const guestEndpoint = `/api/guest${endpoint}`;
    const url = new URL(guestEndpoint, window.location.origin);
    const defaultHeaders = { 'Content-Type': 'application/json' };

    const response = await fetch(url, { ...options, headers: { ...defaultHeaders, ...options.headers } });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API Error: ${response.status}`);
    }
    const result = await response.json();
    return result.data || result;
  }

  const userId = window.getCurrentUserId ? window.getCurrentUserId() : null;
  if (!userId && endpoint !== '/muscle-groups') throw new Error('로그인이 필요합니다.');

  const url = new URL(`${API_BASE_URL}${endpoint}`, window.location.origin);

  // userId injection removed as we use Bearer token now

  const defaultHeaders = { 'Content-Type': 'application/json' };
  const authHeaders = await getAuthHeaders();

  const response = await fetch(url, { ...options, headers: { ...defaultHeaders, ...authHeaders, ...options.headers } });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API Error: ${response.status}`);
  }
  const result = await response.json();
  return result.data || result;
}

// 운동 관련 함수들
async function loadMuscleGroups() {
  try {
    console.log('Fetching muscle groups from:', `${API_BASE_URL}/muscle-groups`);
    const response = await fetch(`${API_BASE_URL}/muscle-groups`);
    if (!response.ok) throw new Error(`Failed to load muscle groups: ${response.status} ${response.statusText}`);
    const result = await response.json();
    muscleGroups = result.data || [];
    console.log('근육부위 목록 로드 완료:', muscleGroups.length, '개');
    return muscleGroups;
  } catch (error) {
    console.error('근육부위 목록 로드 실패:', error);
    throw error;
  }
}

async function loadUserExercises() {
  try {
    const data = await fetchAPI('/exercises');
    userExercises = data || [];
    console.log('사용자 운동 목록 로드 완료:', userExercises);
    return userExercises;
  } catch (error) {
    console.error('사용자 운동 목록 로드 실패:', error);
    throw error;
  }
}

async function loadWeeklyProgress(weekOffset = 0) {
  try {
    const endpoint = weekOffset ? `/weekly-stats?weekOffset=${weekOffset}` : '/weekly-stats';
    const data = await fetchAPI(endpoint);
    weeklyProgress = data.muscleGroups || [];
    console.log('주간 운동 진행률 로드 완료:', weeklyProgress);
    return weeklyProgress;
  } catch (error) {
    console.error('주간 운동 진행률 로드 실패:', error);
    throw error;
  }
}

async function createExerciseAPI(muscleGroupId, exerciseName, weightKg, reps, intensityType = 'reps', rpe = null) {
  if (!muscleGroupId || !exerciseName || !weightKg) throw new Error('필수 필드를 입력해주세요.');
  if (weightKg <= 0) throw new Error('중량은 0보다 커야 합니다.');
  if (intensityType === 'reps' && (!reps || reps <= 0)) throw new Error('횟수는 0보다 커야 합니다.');
  if (intensityType === 'rpe' && (!rpe || rpe <= 0 || rpe > 10)) throw new Error('RPE는 0에서 10 사이여야 합니다.');

  const body = { muscleGroupId, exerciseName: exerciseName.trim(), weightKg: parseFloat(weightKg), intensityType };
  if (intensityType === 'reps') body.reps = parseInt(reps);
  else body.rpe = parseFloat(rpe);

  const data = await fetchAPI('/exercises', { method: 'POST', body: JSON.stringify(body) });
  console.log('운동 등록 완료:', data);
  await loadUserExercises();
  return data;
}

async function logExerciseSessionAPI(exerciseId, setsCompleted, sessionDate = null, notes = null) {
  if (!exerciseId || !setsCompleted) throw new Error('운동과 세트수를 입력해주세요.');
  if (setsCompleted <= 0) throw new Error('세트수는 0보다 커야 합니다.');

  const data = await fetchAPI('/sessions', {
    method: 'POST',
    body: JSON.stringify({
      exerciseId,
      setsCompleted: parseInt(setsCompleted),
      sessionDate: sessionDate || new Date().toISOString().split('T')[0],
      notes
    })
  });
  console.log('운동 세션 기록 완료:', data);
  await loadWeeklyProgress();
  return data;
}

async function updateExerciseAPI(exerciseId, updates) {
  const apiUpdates = {};
  if (updates.exercise_name) apiUpdates.exerciseName = updates.exercise_name;
  if (updates.weight_kg) apiUpdates.weightKg = updates.weight_kg;
  if (updates.reps) apiUpdates.reps = updates.reps;
  if (updates.intensity_type) apiUpdates.intensityType = updates.intensity_type;
  if (updates.rpe) apiUpdates.rpe = updates.rpe;

  await fetchAPI(`/exercises/${exerciseId}`, { method: 'PUT', body: JSON.stringify(apiUpdates) });
  console.log('운동 수정 완료:', exerciseId);
  await loadUserExercises();
}

async function deleteExerciseAPI(exerciseId) {
  await fetchAPI(`/exercises/${exerciseId}`, { method: 'DELETE' });
  console.log('운동 삭제 완료:', exerciseId);
  await loadUserExercises();
  await loadWeeklyProgress();
}

function getWeeklyStats() {
  if (!weeklyProgress.length) return { totalMuscleGroups: 0, mevAchieved: 0, mavAchieved: 0, needsMotivation: 0 };
  return {
    totalMuscleGroups: weeklyProgress.length,
    mevAchieved: weeklyProgress.filter(p => p.current_sets >= p.mev_sets).length,
    mavAchieved: weeklyProgress.filter(p => p.current_sets >= p.mav_sets).length,
    needsMotivation: weeklyProgress.filter(p => p.current_sets < p.mev_sets).length
  };
}

// 푸시 알림 및 운동 관리자 초기화 함수 (Modified to focus on Exercise)
async function initializeManagers() {
  try {
    // 근육부위 목록은 로그인 후에만 로드
    // 운동 데이터 로드
    const userId = window.getCurrentUserId ? window.getCurrentUserId() : null;
    if (userId) {
      await loadExerciseData();
    }

    // user-synced 이벤트 리스너 등록
    window.addEventListener('user-synced', async (e) => {
      console.log('User synced event received in index.js (Exercise Manager)');
      await loadExerciseData();
    });

  } catch (error) {
    console.error('매니저 초기화 실패:', error);
  }
}

async function loadExerciseData() {
  try {
    await loadMuscleGroups();
  } catch (error) {
    console.error('근육부위 목록 로드 실패:', error);
  }

  try {
    await loadUserExercises();
  } catch (error) {
    console.error('사용자 운동 목록 로드 실패:', error);
  }

  try {
    await loadWeeklyProgress();
  } catch (error) {
    console.error('주간 진행률 로드 실패:', error);
  }

  // UI 업데이트
  updateExerciseUI();
  updateWeeklyProgressDashboard();
}

// 운동 관리 UI 업데이트 함수
async function updateExerciseUI() {
  try {
    // 근육부위 드롭다운 업데이트
    const muscleGroupSelect = document.getElementById('muscle-group-select');
    if (muscleGroupSelect) {
      muscleGroupSelect.innerHTML = '<option value="">근육부위를 선택하세요</option>';
      console.log('Updating muscle group select with', muscleGroups.length, 'groups');
      muscleGroups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = group.name_ko;
        muscleGroupSelect.appendChild(option);
      });
    }

    // 운동 목록 업데이트
    updateUserExercisesList();

    // 운동 선택 드롭다운 업데이트
    updateExerciseSelectOptions();

    // 오늘 날짜 설정
    const sessionDateInput = document.getElementById('session-date-input');
    if (sessionDateInput) {
      sessionDateInput.value = new Date().toISOString().split('T')[0];
    }

  } catch (error) {
    console.error('운동 UI 업데이트 실패:', error);
  }
}

// 사용자 운동 목록 업데이트
function updateUserExercisesList() {
  const listContainer = document.getElementById('user-exercises-list');

  if (!listContainer) return;

  if (userExercises.length === 0) {
    listContainer.innerHTML = `
      <div class="exercise-list-empty">
        <div class="exercise-list-empty-icon">🏋️</div>
        <div class="exercise-list-empty-text">등록된 운동이 없습니다.<br>운동을 추가해보세요!</div>
      </div>
    `;
    return;
  }

  const exercisesByMuscleGroup = {};
  userExercises.forEach(exercise => {
    if (!exercisesByMuscleGroup[exercise.muscle_group_name_ko]) {
      exercisesByMuscleGroup[exercise.muscle_group_name_ko] = [];
    }
    exercisesByMuscleGroup[exercise.muscle_group_name_ko].push(exercise);
  });

  let html = '';
  Object.keys(exercisesByMuscleGroup).forEach(muscleGroupName => {
    html += `
      <div class="exercise-group">
        <div class="exercise-group-header">
          <span class="exercise-group-name">${muscleGroupName}</span>
          <span class="exercise-group-count">${exercisesByMuscleGroup[muscleGroupName].length}개</span>
        </div>
        <div class="exercise-list">
    `;

    exercisesByMuscleGroup[muscleGroupName].forEach(exercise => {
      // intensity_type이 'rpe'이거나, rpe 값이 있으면 RPE로 표시
      const isRpe = exercise.intensity_type === 'rpe' || (exercise.rpe && !exercise.reps);
      const intensityDisplay = isRpe
        ? `RPE ${exercise.rpe || '-'}`
        : `${exercise.reps || '-'}회`;
      html += `
        <div class="exercise-item">
          <div class="exercise-info">
            <div class="exercise-name">${exercise.exercise_name}</div>
            <div class="exercise-details">${exercise.weight_kg}kg × ${intensityDisplay}</div>
          </div>
          <div class="exercise-actions">
            <button class="exercise-action-btn edit" onclick="editExercise('${exercise.id}')" title="수정">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button class="exercise-action-btn delete" onclick="deleteExercise('${exercise.id}')" title="삭제">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  listContainer.innerHTML = html;
}

// 운동 선택 드롭다운 업데이트
function updateExerciseSelectOptions() {
  const exerciseSelect = document.getElementById('session-exercise-select');
  if (!exerciseSelect) return;

  exerciseSelect.innerHTML = '<option value="">운동을 선택하세요</option>';

  const exercisesByMuscleGroup = {};
  userExercises.forEach(exercise => {
    if (!exercisesByMuscleGroup[exercise.muscle_group_name_ko]) {
      exercisesByMuscleGroup[exercise.muscle_group_name_ko] = [];
    }
    exercisesByMuscleGroup[exercise.muscle_group_name_ko].push(exercise);
  });

  Object.keys(exercisesByMuscleGroup).forEach(muscleGroupName => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = muscleGroupName;

    exercisesByMuscleGroup[muscleGroupName].forEach(exercise => {
      const option = document.createElement('option');
      option.value = exercise.id;
      // intensity_type이 'rpe'이거나, rpe 값이 있으면 RPE로 표시
      const isRpe = exercise.intensity_type === 'rpe' || (exercise.rpe && !exercise.reps);
      const intensityDisplay = isRpe
        ? `RPE ${exercise.rpe || '-'}`
        : `${exercise.reps || '-'}회`;
      option.textContent = `${exercise.exercise_name} (${exercise.weight_kg}kg × ${intensityDisplay})`;
      optgroup.appendChild(option);
    });

    exerciseSelect.appendChild(optgroup);
  });
}

// 운동 관리 이벤트 리스너 설정
function setupExerciseEventListeners() {
  // 새 운동 등록 모달 열기/닫기
  const addExerciseModal = document.getElementById('add-exercise-modal');
  const openAddExerciseModalBtn = document.getElementById('open-add-exercise-modal');
  const addExerciseModalClose = document.getElementById('add-exercise-modal-close');
  const addExerciseModalCancel = document.getElementById('add-exercise-modal-cancel');

  if (openAddExerciseModalBtn) {
    openAddExerciseModalBtn.addEventListener('click', () => {
      addExerciseModal.style.display = 'block';
      document.body.classList.add('modal-open');
      onModalOpen();
    });
  }

  if (addExerciseModalClose) {
    addExerciseModalClose.addEventListener('click', () => {
      addExerciseModal.style.display = 'none';
      document.body.classList.remove('modal-open');
      onModalClose();
    });
  }

  if (addExerciseModalCancel) {
    addExerciseModalCancel.addEventListener('click', () => {
      addExerciseModal.style.display = 'none';
      document.body.classList.remove('modal-open');
      onModalClose();
    });
  }

  // 모달 외부 클릭 시 닫기
  if (addExerciseModal) {
    addExerciseModal.addEventListener('click', (e) => {
      if (e.target === addExerciseModal) {
        addExerciseModal.style.display = 'none';
        document.body.classList.remove('modal-open');
        onModalClose();
      }
    });
  }

  // 등록된 운동 목록 모달 열기/닫기
  const exerciseListModal = document.getElementById('exercise-list-modal');
  const openExerciseListModalBtn = document.getElementById('open-exercise-list-modal');
  const exerciseListModalClose = document.getElementById('exercise-list-modal-close');

  if (openExerciseListModalBtn) {
    openExerciseListModalBtn.addEventListener('click', () => {
      exerciseListModal.style.display = 'block';
      document.body.classList.add('modal-open');
      onModalOpen();
    });
  }

  if (exerciseListModalClose) {
    exerciseListModalClose.addEventListener('click', () => {
      exerciseListModal.style.display = 'none';
      document.body.classList.remove('modal-open');
      onModalClose();
    });
  }

  // 운동 목록 모달 외부 클릭 시 닫기
  if (exerciseListModal) {
    exerciseListModal.addEventListener('click', (e) => {
      if (e.target === exerciseListModal) {
        exerciseListModal.style.display = 'none';
        document.body.classList.remove('modal-open');
        onModalClose();
      }
    });
  }

  // 운동 등록 버튼
  const addExerciseBtn = document.getElementById('add-exercise-btn');
  if (addExerciseBtn) {
    addExerciseBtn.addEventListener('click', async () => {
      try {
        const muscleGroupId = document.getElementById('muscle-group-select').value;
        const exerciseName = document.getElementById('exercise-name-input').value;
        const weight = document.getElementById('exercise-weight-input').value;
        const intensityType = document.querySelector('input[name="intensity-type"]:checked').value;
        const repsInput = document.getElementById('exercise-reps-input').value;

        let reps = null;
        let rpe = null;

        if (intensityType === 'reps') {
          if (parseInt(repsInput) >= 100) {
            showExerciseMessage('횟수는 100회 미만으로 설정해주세요.', 'error', 'exercise-form-result');
            return;
          }
          reps = repsInput;
        } else {
          rpe = repsInput;
        }

        await createExerciseAPI(muscleGroupId, exerciseName, weight, reps, intensityType, rpe);

        // 폼 초기화
        document.getElementById('muscle-group-select').value = '';
        document.getElementById('exercise-name-input').value = '';
        document.getElementById('exercise-weight-input').value = '';
        document.getElementById('exercise-reps-input').value = '';
        // Reset type to reps
        document.getElementById('type-reps').checked = true;
        document.getElementById('exercise-reps-input').placeholder = '10';
        document.getElementById('exercise-reps-input').step = '1';
        document.getElementById('exercise-intensity-label').textContent = '횟수';
        const helperText = document.getElementById('rpe-helper-text');
        if (helperText) {
          helperText.style.display = 'none';
          helperText.classList.remove('visible');
        }

        // UI 업데이트
        updateUserExercisesList();
        updateExerciseSelectOptions();

        // 모달 닫기
        if (addExerciseModal) {
          addExerciseModal.style.display = 'none';
        }

        showExerciseMessage('운동이 등록되었습니다!', 'success', 'exercise-form-result');

      } catch (error) {
        console.error('운동 등록 실패:', error);
        showExerciseMessage('운동 등록에 실패했습니다: ' + error.message, 'error', 'exercise-form-result');
      }
    });
  }

  // 세션 기록 버튼
  const logSessionBtn = document.getElementById('log-session-btn');
  if (logSessionBtn) {
    logSessionBtn.addEventListener('click', async () => {
      try {
        const exerciseId = document.getElementById('session-exercise-select').value;
        const sets = document.getElementById('session-sets-input').value;
        const date = document.getElementById('session-date-input').value;
        const notes = document.getElementById('session-notes-input').value;

        await logExerciseSessionAPI(exerciseId, sets, date, notes);

        // 폼 초기화
        document.getElementById('session-exercise-select').value = '';
        document.getElementById('session-sets-input').value = '';
        document.getElementById('session-notes-input').value = '';

        // 대시보드 업데이트
        updateWeeklyProgressDashboard();

        showExerciseMessage('운동 세션이 기록되었습니다!', 'success', 'session-form-result');

      } catch (error) {
        console.error('세션 기록 실패:', error);
        showExerciseMessage('세션 기록에 실패했습니다: ' + error.message, 'error', 'session-form-result');
      }
    });
  }

  // 세트수 입력 시 한 자리 숫자 입력하면 자동으로 키패드 내림
  const sessionSetsInput = document.getElementById('session-sets-input');
  if (sessionSetsInput) {
    sessionSetsInput.addEventListener('input', (e) => {
      const value = e.target.value;
      // 숫자가 1자리 입력되면 blur하여 키패드 내림
      if (value.length === 1 && /^\d$/.test(value)) {
        e.target.blur();
      }
    });
  }

  // 새로고침 버튼
  const refreshExercisesBtn = document.getElementById('refresh-exercises-btn');
  if (refreshExercisesBtn) {
    refreshExercisesBtn.addEventListener('click', async () => {
      refreshExercisesBtn.classList.add('refreshing');
      try {
        await loadExerciseData();
        showExerciseMessage('운동 목록이 새로고침되었습니다.', 'info', 'exercise-form-result');
      } finally {
        setTimeout(() => {
          refreshExercisesBtn.classList.remove('refreshing');
        }, 300);
      }
    });
  }

  // 진행률 새로고침 버튼
  const refreshProgressBtn = document.getElementById('refresh-progress-btn');
  if (refreshProgressBtn) {
    refreshProgressBtn.addEventListener('click', async () => {
      try {
        refreshProgressBtn.classList.add('refreshing');
        await loadWeeklyProgress();
        updateWeeklyProgressDashboard();
      } catch (error) {
        console.error('진행률 새로고침 실패:', error);
      } finally {
        setTimeout(() => {
          refreshProgressBtn.classList.remove('refreshing');
        }, 300);
      }
    });
  }

  // 진행률 새로고침 버튼 (모달)
  const refreshProgressModalBtn = document.getElementById('refresh-progress-modal-btn');
  if (refreshProgressModalBtn) {
    refreshProgressModalBtn.addEventListener('click', async () => {
      try {
        refreshProgressModalBtn.classList.add('refreshing');
        await loadWeeklyProgress();
        updateWeeklyProgressDashboard();
      } catch (error) {
        console.error('진행률 새로고침 실패:', error);
      } finally {
        setTimeout(() => {
          refreshProgressModalBtn.classList.remove('refreshing');
        }, 300);
      }
    });
  }
  // Intensity Type Toggle (Segmented Control)
  const intensityRadios = document.querySelectorAll('input[name="intensity-type"]');
  const repsInput = document.getElementById('exercise-reps-input');
  const helperText = document.getElementById('rpe-helper-text');

  if (intensityRadios.length > 0 && repsInput) {
    intensityRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.value === 'rpe') {
          repsInput.placeholder = '8'; // RPE example
          repsInput.step = '0.5';
          document.getElementById('exercise-intensity-label').textContent = 'RPE';
          if (helperText) {
            helperText.style.display = 'block';
            helperText.classList.add('visible');
          }
        } else {
          repsInput.placeholder = '10';
          repsInput.step = '1';
          document.getElementById('exercise-intensity-label').textContent = '횟수';
          if (helperText) {
            helperText.style.display = 'none';
            helperText.classList.remove('visible');
          }
        }
      });
    });
  }

  // 운동 수정 모달 이벤트 리스너
  const exerciseEditModal = document.getElementById('exercise-edit-modal');
  const exerciseEditClose = document.getElementById('exercise-edit-close');
  const exerciseEditCancel = document.getElementById('exercise-edit-cancel-btn');
  const exerciseEditSave = document.getElementById('exercise-edit-save-btn');

  if (exerciseEditClose) {
    exerciseEditClose.addEventListener('click', () => {
      exerciseEditModal.style.display = 'none';
      document.body.classList.remove('modal-open');
      onModalClose();
    });
  }

  if (exerciseEditCancel) {
    exerciseEditCancel.addEventListener('click', () => {
      exerciseEditModal.style.display = 'none';
      document.body.classList.remove('modal-open');
      onModalClose();
    });
  }

  if (exerciseEditSave) {
    exerciseEditSave.addEventListener('click', saveExerciseEdit);
  }

  // 운동 삭제 모달 이벤트 리스너
  const exerciseDeleteModal = document.getElementById('exercise-delete-modal');
  const exerciseDeleteCancel = document.getElementById('exercise-delete-cancel-btn');
  const exerciseDeleteConfirm = document.getElementById('exercise-delete-confirm-btn');

  if (exerciseDeleteCancel) {
    exerciseDeleteCancel.addEventListener('click', () => {
      exerciseDeleteModal.style.display = 'none';
      document.body.classList.remove('modal-open');
      onModalClose();
    });
  }

  if (exerciseDeleteConfirm) {
    exerciseDeleteConfirm.addEventListener('click', confirmExerciseDelete);
  }

  // 모달 외부 클릭 시 닫기
  if (exerciseEditModal) {
    exerciseEditModal.addEventListener('click', (e) => {
      if (e.target === exerciseEditModal) {
        exerciseEditModal.style.display = 'none';
        document.body.classList.remove('modal-open');
        onModalClose();
      }
    });
  }

  if (exerciseDeleteModal) {
    exerciseDeleteModal.addEventListener('click', (e) => {
      if (e.target === exerciseDeleteModal) {
        exerciseDeleteModal.style.display = 'none';
        document.body.classList.remove('modal-open');
        onModalClose();
      }
    });
  }
  // 주간 헬스 진행률 모달 이벤트 리스너
  const exerciseWeeklyModal = document.getElementById('exercise-weekly-modal');
  const openExerciseWeeklyModalBtn = document.getElementById('open-exercise-weekly-modal');
  const exerciseWeeklyClose = document.getElementById('exercise-weekly-close');

  if (openExerciseWeeklyModalBtn) {
    openExerciseWeeklyModalBtn.addEventListener('click', async () => {
      if (exerciseWeeklyModal) {
        // 데이터 최신화
        try {
          await loadWeeklyProgress();
          updateWeeklyProgressDashboard();
        } catch (e) {
          console.error('Failed to load weekly progress', e);
        }
        exerciseWeeklyModal.style.display = 'block';
        document.body.classList.add('modal-open');
        onModalOpen();
      }
    });
  }

  if (exerciseWeeklyClose) {
    exerciseWeeklyClose.addEventListener('click', () => {
      if (exerciseWeeklyModal) {
        exerciseWeeklyModal.style.display = 'none';
        document.body.classList.remove('modal-open');
        onModalClose();
      }
    });
  }

  if (exerciseWeeklyModal) {
    exerciseWeeklyModal.addEventListener('click', (e) => {
      if (e.target === exerciseWeeklyModal) {
        exerciseWeeklyModal.style.display = 'none';
        document.body.classList.remove('modal-open');
        onModalClose();
      }
    });
  }
}

// 운동 관련 메시지 표시 함수
function showExerciseMessage(message, type = 'info', elementId = 'exercise-form-result') {
  const messageElement = document.getElementById(elementId);
  if (messageElement) {
    messageElement.textContent = message;
    messageElement.className = `result-message result-${type}`;
    messageElement.style.display = 'block';

    // 3초 후 자동 숨김
    setTimeout(() => {
      messageElement.style.display = 'none';
    }, 3000);
  }
}

// 운동 수정 함수 (전역) - 모달 기반 UI
function editExercise(exerciseId) {
  try {
    const exercise = userExercises.find(e => e.id === exerciseId);
    if (!exercise) {
      throw new Error('운동을 찾을 수 없습니다.');
    }

    // 모달에 데이터 채우기
    document.getElementById('edit-exercise-name').value = exercise.exercise_name;
    document.getElementById('edit-exercise-weight').value = exercise.weight_kg;
    document.getElementById('edit-exercise-id').value = exerciseId;

    // intensity_type이 'rpe'이거나, rpe 값이 있으면 RPE로 판단
    const isRpe = exercise.intensity_type === 'rpe' || (exercise.rpe && !exercise.reps);
    const intensityType = isRpe ? 'rpe' : 'reps';
    document.getElementById('edit-exercise-intensity-type').value = intensityType;

    const intensityLabel = document.getElementById('edit-exercise-intensity-label');
    const repsInput = document.getElementById('edit-exercise-reps');

    if (intensityType === 'rpe') {
      intensityLabel.textContent = 'RPE (1-10)';
      repsInput.value = exercise.rpe || '';
      repsInput.placeholder = 'RPE';
    } else {
      intensityLabel.textContent = '횟수';
      repsInput.value = exercise.reps || '';
      repsInput.placeholder = '횟수';
    }

    // 모달 표시
    document.getElementById('exercise-edit-modal').style.display = 'block';
    document.body.classList.add('modal-open');
    onModalOpen();

  } catch (error) {
    console.error('운동 수정 모달 열기 실패:', error);
    showExerciseMessage('운동을 찾을 수 없습니다: ' + error.message, 'error', 'exercise-form-result');
  }
}

// 운동 수정 저장 처리
async function saveExerciseEdit() {
  try {
    const exerciseId = document.getElementById('edit-exercise-id').value;
    const intensityType = document.getElementById('edit-exercise-intensity-type').value;

    const newName = document.getElementById('edit-exercise-name').value.trim();
    const newWeight = parseFloat(document.getElementById('edit-exercise-weight').value);
    const newRepsValue = document.getElementById('edit-exercise-reps').value;

    if (!newName) {
      showExerciseMessage('운동 이름을 입력해주세요.', 'error', 'exercise-form-result');
      return;
    }

    if (isNaN(newWeight) || newWeight <= 0) {
      showExerciseMessage('올바른 중량을 입력해주세요.', 'error', 'exercise-form-result');
      return;
    }

    const updates = {
      exercise_name: newName,
      weight_kg: newWeight
    };

    if (intensityType === 'rpe') {
      const rpe = parseFloat(newRepsValue);
      if (isNaN(rpe) || rpe < 0 || rpe > 10) {
        showExerciseMessage('RPE는 0~10 사이여야 합니다.', 'error', 'exercise-form-result');
        return;
      }
      updates.rpe = rpe;
    } else {
      const reps = parseInt(newRepsValue);
      if (isNaN(reps) || reps <= 0) {
        showExerciseMessage('올바른 횟수를 입력해주세요.', 'error', 'exercise-form-result');
        return;
      }
      if (reps >= 100) {
        showExerciseMessage('횟수는 100회 미만으로 설정해주세요.', 'error', 'exercise-form-result');
        return;
      }
      updates.reps = reps;
    }

    await updateExerciseAPI(exerciseId, updates);
    updateUserExercisesList();
    updateExerciseSelectOptions();

    // 모달 닫기
    document.getElementById('exercise-edit-modal').style.display = 'none';
    document.body.classList.remove('modal-open');
    onModalClose();
    showExerciseMessage('운동이 수정되었습니다!', 'success', 'exercise-form-result');

  } catch (error) {
    console.error('운동 수정 실패:', error);
    showExerciseMessage('운동 수정에 실패했습니다: ' + error.message, 'error', 'exercise-form-result');
  }
}

// 운동 삭제 함수 (전역) - 모달 기반 UI
function deleteExercise(exerciseId) {
  try {
    const exercise = userExercises.find(e => e.id === exerciseId);
    if (!exercise) {
      throw new Error('운동을 찾을 수 없습니다.');
    }

    // 모달에 데이터 채우기
    document.getElementById('delete-exercise-id').value = exerciseId;
    document.getElementById('exercise-delete-message').innerHTML =
      `<strong>${exercise.exercise_name}</strong> 운동을 삭제하시겠습니까?<br><small style="color: #a0aec0;">이 작업은 되돌릴 수 없습니다.</small>`;

    // 모달 표시
    document.getElementById('exercise-delete-modal').style.display = 'block';
    document.body.classList.add('modal-open');
    onModalOpen();

  } catch (error) {
    console.error('운동 삭제 모달 열기 실패:', error);
    showExerciseMessage('운동을 찾을 수 없습니다: ' + error.message, 'error', 'exercise-form-result');
  }
}

// 운동 삭제 확인 처리
async function confirmExerciseDelete() {
  try {
    const exerciseId = document.getElementById('delete-exercise-id').value;

    await deleteExerciseAPI(exerciseId);
    updateUserExercisesList();
    updateExerciseSelectOptions();
    updateWeeklyProgressDashboard();

    // 모달 닫기
    document.getElementById('exercise-delete-modal').style.display = 'none';
    document.body.classList.remove('modal-open');
    onModalClose();
    showExerciseMessage('운동이 삭제되었습니다.', 'info', 'exercise-form-result');

  } catch (error) {
    console.error('운동 삭제 실패:', error);
    document.getElementById('exercise-delete-modal').style.display = 'none';
    document.body.classList.remove('modal-open');
    onModalClose();
    showExerciseMessage('운동 삭제에 실패했습니다: ' + error.message, 'error', 'exercise-form-result');
  }
}

// 주간 운동 진행률 대시보드 업데이트
async function updateWeeklyProgressDashboard() {
  try {
    // 근육부위별 진행률 상세 업데이트 (메인 화면 카드 & 모달)
    const containers = [
      document.getElementById('weekly-progress-details'),
      document.getElementById('weekly-progress-modal-details')
    ];

    // Check if at least one container exists
    if (!containers.some(c => c)) return;

    if (weeklyProgress.length === 0) {
      const emptyHtml = '<p style="text-align: center; color: #666; margin: 20px 0;">운동을 등록하고 세션을 기록해보세요!</p>';
      containers.forEach(c => { if (c) c.innerHTML = emptyHtml; });
      return;
    }

    let html = '';
    weeklyProgress.forEach(progress => {
      // Find muscle group details to get full stats if missing
      const muscleGroup = muscleGroups.find(mg => mg.id === progress.muscle_group_id) || {};

      // API returns total_sets, not current_sets
      const current = parseInt(progress.total_sets) || parseInt(progress.current_sets) || 0;
      const mv = parseInt(progress.mv_sets !== undefined ? progress.mv_sets : (muscleGroup.mv_sets || 0));
      const mev = parseInt(progress.mev_sets !== undefined ? progress.mev_sets : (muscleGroup.mev_sets || 0));
      // Fallback logic: try mav_min_sets, then mav_sets, then default
      const mav_min = parseInt(progress.mav_min_sets !== undefined ? progress.mav_min_sets :
        (muscleGroup.mav_min_sets !== undefined ? muscleGroup.mav_min_sets :
          (progress.mav_sets || muscleGroup.mav_sets || 10)));

      const mav_max = parseInt(progress.mav_max_sets !== undefined ? progress.mav_max_sets :
        (muscleGroup.mav_max_sets !== undefined ? muscleGroup.mav_max_sets :
          (mav_min + 4)));

      const mrv = parseInt(progress.mrv_sets !== undefined ? progress.mrv_sets : (muscleGroup.mrv_sets || 20));

      let statusText = '';
      let statusClass = '';
      let statusBadgeClass = '';
      let message = '';
      let messageColor = '';

      if (current <= mv) {
        statusText = '근손실';
        statusClass = 'status-loss';
        statusBadgeClass = 'badge-loss';
        message = `💪 MV(${mv}세트) 이하입니다. ${mv + 1}세트 이상 해야 근손실을 방지할 수 있어요!`;
        messageColor = '#718096';
      } else if (current <= mev) {
        statusText = '근유지';
        statusClass = 'status-maintenance';
        statusBadgeClass = 'badge-maintenance';
        message = `🔥 MV(${mv}) 달성! MEV(${mev}세트)까지 ${mev - current}세트 남았어요.`;
        messageColor = '#d69e2e';
      } else if (current <= mav_min) {
        statusText = '근자극';
        statusClass = 'status-stimulation';
        statusBadgeClass = 'badge-stimulation';
        message = `✨ MEV(${mev}) 달성! MAV(${mav_min}~${mav_max}세트)까지 ${mav_min - current}세트 남았어요.`;
        messageColor = '#38a169';
      } else if (current <= mav_max) {
        statusText = '최적근성장';
        statusClass = 'status-optimal';
        statusBadgeClass = 'badge-optimal';
        message = `🏆 완벽해요! MAV(${mav_min}~${mav_max}세트) 최적의 근성장 구간입니다.`;
        messageColor = '#805ad5';
      } else if (current <= mrv) {
        statusText = '한계근성장';
        statusClass = 'status-limit';
        statusBadgeClass = 'badge-limit';
        message = `⚠️ MAV 초과! MRV(${mrv}세트)까지 ${mrv - current}세트 남았어요. 주의하세요.`;
        messageColor = '#dd6b20';
      } else {
        statusText = '과잉';
        statusClass = 'status-excess';
        statusBadgeClass = 'badge-excess';
        message = `🚫 MRV(${mrv}세트) 초과! 오버트레이닝 위험, 휴식이 필요합니다.`;
        messageColor = '#e53e3e';
      }

      // Progress bar percentage relative to MRV (capped at 100%)
      // Using MRV as the 100% mark for the bar gives a good visual indication of "full capacity"
      const progressPercentage = mrv > 0 ? Math.min((current / mrv) * 100, 100) : 0;

      html += `
          <div class="muscle-progress-card">
            <div class="muscle-progress-header">
              <div class="muscle-progress-name">${progress.muscle_group_name_ko}</div>
              <div class="muscle-progress-status ${statusBadgeClass}">${statusText}</div>
            </div>
            
            <div class="progress-bar-container">
              <div class="progress-bar ${statusClass}" style="width: ${progressPercentage}%"></div>
            </div>
            
            <div class="progress-details">
              <span>현재: ${current}세트</span>
              <span>MAV: ${mav_min}~${mav_max} / MRV: ${mrv}</span>
            </div>
            
            <div style="margin-top: 8px; font-size: 12px; color: ${messageColor}; font-weight: 500;">
              ${message}
            </div>
          </div>
        `;
    });

    containers.forEach(c => { if (c) c.innerHTML = html; });

  } catch (error) {
    console.error('주간 진행률 대시보드 업데이트 실패:', error);
  }
}

// Initialize Exercise Logic
document.addEventListener('DOMContentLoaded', () => {
  initializeManagers();
  setupExerciseEventListeners();
  initPokemonFilter(); // 포켓몬 필터 초기화
});

// Expose functions globally for HTML event handlers
window.editExercise = editExercise;
window.deleteExercise = deleteExercise;

// ==========================================
// 포켓몬 필터 시스템
// ==========================================

// 필터 상태 (localStorage에 저장)
const FILTER_STORAGE_KEY = 'pokemonCollectionFilter';
let currentFilter = {
  favoritesOnly: false,
  showFavoriteIcon: true, // 즐겨찾기 아이콘 표시 여부
  completion: 'all', // 'all', 'complete', 'incomplete'
  types: [], // 복수 타입 선택 가능 ([] = 전체)
  generations: [], // 복수 세대 선택 가능 ([] = 전체)
  sort: 'default' // 'default', 'progress-high', 'progress-low', 'generation'
};

// 필터 설정 불러오기
function loadFilterSettings() {
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    if (saved) {
      currentFilter = { ...currentFilter, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('필터 설정 로드 실패:', e);
  }
  return currentFilter;
}

// 필터 설정 저장
function saveFilterSettings() {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(currentFilter));
  } catch (e) {
    console.warn('필터 설정 저장 실패:', e);
  }
}

// 필터 모달 초기화
function initPokemonFilter() {
  loadFilterSettings();

  const filterBtn = document.getElementById('filterIconsBtn');
  const filterModal = document.getElementById('pokemon-filter-modal');
  const filterClose = document.getElementById('filter-modal-close');
  const filterApply = document.getElementById('filter-apply-btn');
  const filterReset = document.getElementById('filter-reset-btn');
  const favoritesToggle = document.getElementById('filter-favorites-toggle');
  const showFavoriteIconToggle = document.getElementById('filter-show-favorite-icon');

  if (!filterBtn || !filterModal) return;

  // 필터 버튼 클릭 - 모달 열기
  filterBtn.addEventListener('click', () => {
    openFilterModal();
  });

  // 모달 닫기 함수 (필터 자동 적용)
  const closeFilterModal = () => {
    applyFilter(); // 필터를 자동으로 적용
    filterModal.style.display = 'none';
    document.body.classList.remove('modal-open');
    onModalClose();
  };

  // 모달 닫기 버튼
  if (filterClose) {
    filterClose.addEventListener('click', closeFilterModal);
  }

  // 모달 외부 클릭 시 닫기 (필터 자동 적용)
  filterModal.addEventListener('click', (e) => {
    if (e.target === filterModal) {
      closeFilterModal();
    }
  });

  // 즐겨찾기 토글
  if (favoritesToggle) {
    favoritesToggle.addEventListener('click', () => {
      favoritesToggle.classList.toggle('active');
    });
  }

  // 즐겨찾기 아이콘 표시 토글
  if (showFavoriteIconToggle) {
    showFavoriteIconToggle.addEventListener('click', () => {
      showFavoriteIconToggle.classList.toggle('active');
    });
  }

  // 필터 칩 클릭 이벤트
  filterModal.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const filterType = chip.dataset.filter;
      // data-filter가 없는 경우(토글 버튼 등)는 공통 로직 무시
      if (!filterType) return;

      const value = chip.dataset.value;

      if (filterType === 'type') {
        // 타입은 최대 2개까지 선택 가능
        if (value === 'all') {
          // '전체' 선택 시 다른 타입 모두 해제
          filterModal.querySelectorAll('.filter-chip[data-filter="type"]').forEach(c => {
            c.classList.remove('active');
          });
          chip.classList.add('active');
        } else {
          // 특정 타입 선택 시 '전체' 해제
          filterModal.querySelector('.filter-chip[data-filter="type"][data-value="all"]')?.classList.remove('active');

          if (chip.classList.contains('active')) {
            // 이미 선택된 칩은 해제
            chip.classList.remove('active');
          } else {
            // 새로 선택하려고 할 때 - 현재 선택된 개수 확인
            const currentlySelected = filterModal.querySelectorAll('.filter-chip[data-filter="type"].active:not([data-value="all"])').length;
            if (currentlySelected >= 2) {
              showToast('타입은 최대 2개까지 선택할 수 있습니다.');
            } else {
              chip.classList.add('active');
            }
          }

          // 선택된 타입이 없으면 '전체' 활성화
          const anyTypeSelected = filterModal.querySelectorAll('.filter-chip[data-filter="type"].active:not([data-value="all"])').length > 0;
          if (!anyTypeSelected) {
            filterModal.querySelector('.filter-chip[data-filter="type"][data-value="all"]')?.classList.add('active');
          }
        }
      } else if (filterType === 'generation') {
        // 세대는 다중 선택 가능
        if (value === 'all') {
          // '전체' 선택 시 다른 세대 모두 해제
          filterModal.querySelectorAll('.filter-chip[data-filter="generation"]').forEach(c => {
            c.classList.remove('active');
          });
          chip.classList.add('active');
        } else {
          // 특정 세대 선택 시 '전체' 해제
          filterModal.querySelector('.filter-chip[data-filter="generation"][data-value="all"]')?.classList.remove('active');
          chip.classList.toggle('active');

          // 선택된 세대가 없으면 '전체' 활성화
          const anyGenerationSelected = filterModal.querySelectorAll('.filter-chip[data-filter="generation"].active:not([data-value="all"])').length > 0;
          if (!anyGenerationSelected) {
            filterModal.querySelector('.filter-chip[data-filter="generation"][data-value="all"]')?.classList.add('active');
          }
        }
      } else {
        // 다른 필터들은 단일 선택
        filterModal.querySelectorAll(`.filter-chip[data-filter="${filterType}"]`).forEach(c => {
          c.classList.remove('active');
        });
        chip.classList.add('active');
      }
    });
  });

  // 완료 버튼
  if (filterApply) {
    filterApply.addEventListener('click', closeFilterModal);
  }

  // 초기화 버튼
  if (filterReset) {
    filterReset.addEventListener('click', () => {
      resetFilter();
    });
  }

  // 필터 활성화 배지 업데이트
  updateFilterBadge();
}

// 필터 모달 열기
function openFilterModal() {
  const filterModal = document.getElementById('pokemon-filter-modal');
  if (!filterModal) return;

  // 현재 필터 상태를 UI에 반영
  syncFilterUI();

  filterModal.style.display = 'block';
  document.body.classList.add('modal-open');
  onModalOpen();
}

// 필터 UI 동기화
function syncFilterUI() {
  const favoritesToggle = document.getElementById('filter-favorites-toggle');
  const showFavoriteIconToggle = document.getElementById('filter-show-favorite-icon');

  // 즐겨찾기 토글
  if (favoritesToggle) {
    if (currentFilter.favoritesOnly) {
      favoritesToggle.classList.add('active');
    } else {
      favoritesToggle.classList.remove('active');
    }
  }

  // 즐겨찾기 아이콘 표시 토글
  if (showFavoriteIconToggle) {
    if (currentFilter.showFavoriteIcon !== false) {
      showFavoriteIconToggle.classList.add('active');
    } else {
      showFavoriteIconToggle.classList.remove('active');
    }
  }

  // 각 칩 그룹 활성화 상태
  document.querySelectorAll('.filter-chip[data-filter]').forEach(chip => {
    chip.classList.remove('active');
    const filterType = chip.dataset.filter;
    const value = chip.dataset.value;

    if (filterType === 'completion' && currentFilter.completion === value) {
      chip.classList.add('active');
    } else if (filterType === 'type') {
      // 타입: 배열이 비어있으면 'all', 아니면 해당 타입들 활성화
      if (currentFilter.types.length === 0 && value === 'all') {
        chip.classList.add('active');
      } else if (currentFilter.types.includes(value)) {
        chip.classList.add('active');
      }
    } else if (filterType === 'generation') {
      // 세대: 배열이 비어있으면 'all', 아니면 해당 세대들 활성화
      if (currentFilter.generations.length === 0 && value === 'all') {
        chip.classList.add('active');
      } else if (currentFilter.generations.includes(value)) {
        chip.classList.add('active');
      }
    } else if (filterType === 'sort' && currentFilter.sort === value) {
      chip.classList.add('active');
    }
  });
}

// 필터 적용
function applyFilter() {
  const favoritesToggle = document.getElementById('filter-favorites-toggle');
  const showFavoriteIconToggle = document.getElementById('filter-show-favorite-icon');

  // UI에서 필터 값 읽기
  currentFilter.favoritesOnly = favoritesToggle?.classList.contains('active') || false;
  currentFilter.showFavoriteIcon = showFavoriteIconToggle?.classList.contains('active') !== false;

  // 완료 상태
  const completionChip = document.querySelector('.filter-chip[data-filter="completion"].active');
  currentFilter.completion = completionChip?.dataset.value || 'all';

  // 타입 (복수 선택)
  const activeTypeChips = document.querySelectorAll('.filter-chip[data-filter="type"].active:not([data-value="all"])');
  currentFilter.types = Array.from(activeTypeChips).map(chip => chip.dataset.value);

  // 세대 (복수 선택)
  const activeGenerationChips = document.querySelectorAll('.filter-chip[data-filter="generation"].active:not([data-value="all"])');
  currentFilter.generations = Array.from(activeGenerationChips).map(chip => chip.dataset.value);

  // 정렬
  const sortChip = document.querySelector('.filter-chip[data-filter="sort"].active');
  currentFilter.sort = sortChip?.dataset.value || 'default';

  // 저장
  saveFilterSettings();

  // 필터 배지 업데이트
  updateFilterBadge();

  // 아이콘 목록 새로고침 (필터 적용)
  loadUserPokemonIcons();

  showToast('필터가 적용되었습니다.');
}

// 필터 초기화
function resetFilter() {
  currentFilter = {
    favoritesOnly: false,
    showFavoriteIcon: true,
    completion: 'all',
    types: [],
    generations: [],
    sort: 'default'
  };

  saveFilterSettings();
  syncFilterUI();
  updateFilterBadge();

  showToast('필터가 초기화되었습니다.');
}

// 필터 활성화 배지 업데이트
function updateFilterBadge() {
  const badge = document.getElementById('filterActiveBadge');
  const filterBtn = document.getElementById('filterIconsBtn');

  if (!badge || !filterBtn) return;

  // 기본값이 아닌 필터가 있으면 배지 표시
  const hasActiveFilter =
    currentFilter.favoritesOnly ||
    currentFilter.completion !== 'all' ||
    currentFilter.types.length > 0 ||
    currentFilter.generations.length > 0 ||
    currentFilter.sort !== 'default';

  if (hasActiveFilter) {
    badge.style.display = 'block';
    filterBtn.classList.add('active');
  } else {
    badge.style.display = 'none';
    filterBtn.classList.remove('active');
  }
}

// 필터링된 포켓몬 목록 가져오기
function getFilteredPokemonList(icons) {
  if (!icons || icons.length === 0) return [];

  let filtered = [...icons];

  // 1. 즐겨찾기 필터
  if (currentFilter.favoritesOnly) {
    filtered = filtered.filter(icon => icon.is_favorite);
  }

  // 2. 완료 상태 필터
  if (currentFilter.completion === 'complete') {
    filtered = filtered.filter(icon => (icon.completion_percentage || 0) >= 100);
  } else if (currentFilter.completion === 'incomplete') {
    filtered = filtered.filter(icon => (icon.completion_percentage || 0) < 100);
  }

  // 3. 타입 필터 (복수 선택 가능)
  if (currentFilter.types.length > 0) {
    filtered = filtered.filter(icon => {
      // 선택된 타입 중 하나라도 일치하면 표시
      return currentFilter.types.includes(icon.type1) || currentFilter.types.includes(icon.type2);
    });
  }

  // 4. 세대 필터 (복수 선택 가능)
  if (currentFilter.generations.length > 0) {
    filtered = filtered.filter(icon => {
      // 선택된 세대 중 하나라도 일치하면 표시
      return currentFilter.generations.includes(icon.generation?.toString());
    });
  }

  // 4. 정렬
  if (currentFilter.sort === 'progress-high') {
    filtered.sort((a, b) => (b.completion_percentage || 0) - (a.completion_percentage || 0));
  } else if (currentFilter.sort === 'progress-low') {
    filtered.sort((a, b) => (a.completion_percentage || 0) - (b.completion_percentage || 0));
  } else if (currentFilter.sort === 'recent') {
    filtered.sort((a, b) => {
      const dateA = new Date(a.obtained_date || 0);
      const dateB = new Date(b.obtained_date || 0);
      return dateB - dateA; // 최신순
    });
  } else if (currentFilter.sort === 'generation') {
    // 세대별 정렬: 세대 → 포켓몬ID → 이로치는 일반 뒤로
    filtered.sort((a, b) => {
      const genA = a.generation || 1;
      const genB = b.generation || 1;
      if (genA !== genB) return genA - genB;
      // 같은 세대 내에서는 포켓몬ID순
      const pokemonIdA = a.pokemon_id || 0;
      const pokemonIdB = b.pokemon_id || 0;
      if (pokemonIdA !== pokemonIdB) return pokemonIdA - pokemonIdB;
      // 같은 포켓몬이면 일반이 먼저, 이로치가 뒤로
      const shinyA = a.is_shiny ? 1 : 0;
      const shinyB = b.is_shiny ? 1 : 0;
      return shinyA - shinyB;
    });
  }
  // 'default'는 서버에서 반환된 순서 그대로

  return filtered;
}

// 전역 함수 노출
window.openFilterModal = openFilterModal;
window.applyFilter = applyFilter;
window.resetFilter = resetFilter;

// 트레이드 숍 모달 관련
const shopModal = document.getElementById('shop-modal');
const shopCloseBtn = document.getElementById('shop-close');

// 트레이드 숍 레시피 정의
const shopRecipes = [
  { cost: 'Shiny Charm', costCount: 1, reward: 'Mystic Charm', rewardCount: 1 },
  { cost: 'Shiny Charm', costCount: 3, reward: 'Oval Charm', rewardCount: 1 },

  { cost: 'Mystic Charm', costCount: 1, reward: 'Shiny Charm', rewardCount: 1 },
  { cost: 'Rare Candy', costCount: 1, reward: 'Shiny Charm', rewardCount: 2 },
  { cost: 'Oval Charm', costCount: 1, reward: 'Shiny Charm', rewardCount: 3 },
  { cost: 'Shiny Charm', costCount: 5, reward: 'Brilliance Charm', rewardCount: 1 },
  { cost: 'Mystic Charm', costCount: 2, reward: 'Awakening Charm', rewardCount: 1 },


];

// 아이템 정보 캐시
let shopItemsCache = null;

async function loadShopItems() {
  if (shopItemsCache) return shopItemsCache;

  try {
    const response = await fetch('/api/shop/items');
    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        shopItemsCache = result.data;
        return result.data;
      }
    }
  } catch (e) {
    console.error('Failed to load shop items:', e);
  }
  return [];
}

// 상점 아이템 렌더링용 유저 아이템 캐시
let shopUserItemsCache = null;

async function renderShopItems() {
  const grid = document.getElementById('shop-items-grid');
  if (!grid) return;

  grid.innerHTML = '<div style="text-align:center; padding:20px;">로딩 중...</div>';

  const items = await loadShopItems();
  const userItems = await fetchUserItems();
  shopUserItemsCache = userItems;

  // 아이템 이름으로 정보 찾기 위한 맵 생성
  const itemMap = {};
  items.forEach(item => {
    itemMap[item.name] = item;
  });

  grid.innerHTML = '';

  shopRecipes.forEach(recipe => {
    const rewardItem = itemMap[recipe.reward];
    const costItem = itemMap[recipe.cost];

    if (!rewardItem || !costItem) return;

    // 재료 보유량 확인
    const userCostCount = userItems[recipe.cost]?.quantity || 0;
    const canAfford = userCostCount >= recipe.costCount;

    const card = document.createElement('div');
    card.className = `shop-item-card${!canAfford ? ' insufficient' : ''}`;

    // 이미지 경로 생성 (IMAGE_URLS 사용 또는 DB image_name 사용)
    // 여기서는 DB image_name을 사용하여 경로 구성
    const rewardImgUrl = `${ASSETS_BASE_URL}/custom/img/items/${rewardItem.image_name}.webp`;
    const costImgUrl = `${ASSETS_BASE_URL}/custom/img/items/${costItem.image_name}.webp`;

    card.innerHTML = `
      <div class="shop-item-icon">
        <img src="${rewardImgUrl}" alt="${rewardItem.name_ko}">
        ${recipe.rewardCount > 1 ? `<span class="item-count-badge">x${recipe.rewardCount}</span>` : ''}
      </div>
      <div class="shop-item-info">
        <h4>${rewardItem.name_ko} ${recipe.rewardCount > 1 ? `x${recipe.rewardCount}` : ''}</h4>
        <p class="shop-item-desc">${rewardItem.description || ''}</p>
      </div>
      <div class="shop-item-price">
        <div class="price-row">
          <img src="${costImgUrl}" alt="${costItem.name_ko}" width="20">
          <span>x${recipe.costCount}</span>
        </div>
      </div>
      <button class="shop-buy-btn${!canAfford ? ' disabled' : ''}" ${!canAfford ? 'disabled' : ''}>
        ${canAfford ? '교환' : '부족'}
      </button>
    `;

    // 이벤트 리스너 추가 (활성화된 경우만)
    if (canAfford) {
      const buyBtn = card.querySelector('.shop-buy-btn');
      buyBtn.onclick = () => exchangeItem(recipe.cost, recipe.costCount, recipe.reward, recipe.rewardCount, userCostCount);
    }

    grid.appendChild(card);
  });
}

// 보유 아이템 렌더링 (한줄 형태)
async function renderMyItems() {
  const container = document.getElementById('my-items-list');
  if (!container) return;

  const items = await loadShopItems();
  const userItems = await fetchUserItems();

  // 아이템 정보로 맵 생성
  const itemMap = {};
  items.forEach(item => {
    itemMap[item.name] = item;
  });

  // shopRecipes에서 사용되는 아이템만 표시
  const relevantItems = new Set();
  shopRecipes.forEach(recipe => {
    relevantItems.add(recipe.cost);
    relevantItems.add(recipe.reward);
  });

  container.innerHTML = '';

  relevantItems.forEach(itemName => {
    const itemInfo = itemMap[itemName];
    if (!itemInfo) return;

    const count = userItems[itemName]?.quantity || 0;
    const imgUrl = `${ASSETS_BASE_URL}/custom/img/items/${itemInfo.image_name}.webp`;

    const item = document.createElement('div');
    item.className = 'my-item-inline';
    item.innerHTML = `
      <img src="${imgUrl}" alt="${itemInfo.name_ko}" title="${itemInfo.name_ko}">
      <span>${count}</span>
    `;
    container.appendChild(item);
  });
}

function openShopModal() {
  if (shopModal) {
    shopModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    onModalOpen();
    renderShopItems();
    renderMyItems();
  }
}

function closeShopModal() {
  if (shopModal) {
    shopModal.style.display = 'none';
    document.body.style.overflow = '';
    onModalClose();
  }
}

if (shopCloseBtn) {
  shopCloseBtn.addEventListener('click', closeShopModal);
}

// 모달 외부 클릭 시 닫기
window.addEventListener('click', (e) => {
  if (e.target === shopModal) {
    closeShopModal();
  }
});

// 아이템 교환 함수
async function exchangeItem(costItemName, costAmount, rewardItemName, rewardAmount, userCostCount) {
  if (!currentUserId) {
    showToast('로그인이 필요합니다.');
    return;
  }

  // 아이템 정보 가져오기 (이름 번역용)
  const items = await loadShopItems();
  const itemMap = {};
  items.forEach(item => itemMap[item.name] = item);

  const costItemInfo = itemMap[costItemName];
  const rewardItemInfo = itemMap[rewardItemName];

  const costNameKo = costItemInfo ? costItemInfo.name_ko : costItemName;
  const rewardNameKo = rewardItemInfo ? rewardItemInfo.name_ko : rewardItemName;

  const costImgUrl = costItemInfo ? `${ASSETS_BASE_URL}/custom/img/items/${costItemInfo.image_name}.webp` : '';
  const rewardImgUrl = rewardItemInfo ? `${ASSETS_BASE_URL}/custom/img/items/${rewardItemInfo.image_name}.webp` : '';

  // 보유량 가져오기 (캐시 또는 실시간)
  const currentUserItems = shopUserItemsCache || await fetchUserItems();
  const currentCostOwned = currentUserItems[costItemName]?.quantity || 0;
  const currentRewardOwned = currentUserItems[rewardItemName]?.quantity || 0;

  // 최대 교환 가능 수량 계산
  const maxExchangeCount = Math.floor(currentCostOwned / costAmount);
  let exchangeQuantity = 1;

  // 수량 업데이트 함수
  const updateQuantityDisplay = () => {
    const qtyDisplay = document.getElementById('exchange-quantity');
    const minusBtn = document.getElementById('exchange-minus');
    const plusBtn = document.getElementById('exchange-plus');
    const costDisplay = document.getElementById('exchange-cost-count');
    const rewardDisplay = document.getElementById('exchange-reward-count');
    const afterCost = document.getElementById('exchange-after-cost');
    const afterReward = document.getElementById('exchange-after-reward');

    if (qtyDisplay) qtyDisplay.textContent = exchangeQuantity;
    if (minusBtn) minusBtn.disabled = exchangeQuantity <= 1;
    if (plusBtn) plusBtn.disabled = exchangeQuantity >= maxExchangeCount;
    if (costDisplay) costDisplay.textContent = `x${costAmount * exchangeQuantity}`;
    if (rewardDisplay) rewardDisplay.textContent = `x${rewardAmount * exchangeQuantity}`;
    if (afterCost) afterCost.textContent = `${currentCostOwned} → ${currentCostOwned - (costAmount * exchangeQuantity)}`;
    if (afterReward) afterReward.textContent = `${currentRewardOwned} → ${currentRewardOwned + (rewardAmount * exchangeQuantity)}`;
  };

  // Sanitize names
  const safeCostName = escapeHtml(costNameKo);
  const safeRewardName = escapeHtml(rewardNameKo);

  // 확인 모달 표시
  const confirmed = await showConfirmModal(
    '아이템 교환',
    `<div style="text-align: center;">
       <div style="display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 16px;">
         <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
           <span style="font-size: 10px; color: #ef4444; font-weight: 600; background: #fef2f2; padding: 2px 8px; border-radius: 4px;">소모</span>
           <div style="width: 56px; height: 56px; background: #fef2f2; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 1px solid #fecaca; position: relative;">
             <img src="${costImgUrl}" width="36" height="36" style="object-fit: contain;" onerror="this.style.display='none'">
           </div>
           <span id="exchange-cost-count" style="font-size: 13px; color: #ef4444; font-weight: 600;">x${costAmount}</span>
           <span style="font-size: 11px; color: #666;">${safeCostName}</span>
           <span id="exchange-after-cost" style="font-size: 10px; color: #999;">${currentCostOwned} → ${currentCostOwned - costAmount}</span>
         </div>
         <div style="color: #cbd5e0; margin-top: -24px;">
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
           </svg>
         </div>
         <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
           <span style="font-size: 10px; color: #10b981; font-weight: 600; background: #ecfdf5; padding: 2px 8px; border-radius: 4px;">획득</span>
           <div style="width: 56px; height: 56px; background: #ecfdf5; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 1px solid #a7f3d0; position: relative;">
             <img src="${rewardImgUrl}" width="36" height="36" style="object-fit: contain;" onerror="this.style.display='none'">
           </div>
           <span id="exchange-reward-count" style="font-size: 13px; color: #10b981; font-weight: 600;">x${rewardAmount}</span>
           <span style="font-size: 11px; color: #666;">${safeRewardName}</span>
           <span id="exchange-after-reward" style="font-size: 10px; color: #999;">${currentRewardOwned} → ${currentRewardOwned + rewardAmount}</span>
         </div>
       </div>
       ${maxExchangeCount > 1 ? `
       <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin: 16px 0; padding: 10px; background: #f8fafc; border-radius: 8px;">
         <span style="font-size: 12px; color: #666;">교환 수량</span>
         <button id="exchange-minus" style="width: 28px; height: 28px; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center;" disabled>−</button>
         <span id="exchange-quantity" style="font-size: 16px; font-weight: 600; min-width: 24px; text-align: center;">1</span>
         <button id="exchange-plus" style="width: 28px; height: 28px; border: 1px solid #e2e8f0; background: white; border-radius: 6px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center;" ${maxExchangeCount <= 1 ? 'disabled' : ''}>＋</button>
         <span style="font-size: 11px; color: #999;">(최대 ${maxExchangeCount}회)</span>
       </div>
       ` : ''}
     </div>`,
    () => {
      // 모달이 열린 후 이벤트 바인딩
      setTimeout(() => {
        const minusBtn = document.getElementById('exchange-minus');
        const plusBtn = document.getElementById('exchange-plus');
        if (minusBtn) {
          minusBtn.onclick = () => {
            if (exchangeQuantity > 1) {
              exchangeQuantity--;
              updateQuantityDisplay();
            }
          };
        }
        if (plusBtn) {
          plusBtn.onclick = () => {
            if (exchangeQuantity < maxExchangeCount) {
              exchangeQuantity++;
              updateQuantityDisplay();
            }
          };
        }
      }, 50);
    }
  );

  if (!confirmed) return;

  const totalCost = costAmount * exchangeQuantity;
  const totalReward = rewardAmount * exchangeQuantity;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/user/exchange', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        // userId extracted from token
        costItemName: costItemName,
        costAmount: totalCost,
        rewardItemName: rewardItemName,
        rewardAmount: totalReward
      })
    });

    const result = await response.json();

    if (result.success) {
      showToast(`${rewardNameKo} ${totalReward}개 교환 완료!`);
      // 아이템 보유량 UI 갱신
      shopUserItemsCache = null;
      renderShopItems();
      renderMyItems();
    } else {
      showToast(result.error || '교환 실패');
    }
  } catch (err) {
    console.error('Exchange error:', err);
    showToast('오류가 발생했습니다.');
  }
}

// 전역 스코프에 함수 노출
window.openShopModal = openShopModal;
window.exchangeItem = exchangeItem;
window.resetFilter = resetFilter;

// 주간 날짜 범위 계산 함수
function updateWeekRanges() {
  const today = new Date();

  // 지난주: 최근 7일 (오늘 포함)
  const lastWeekEnd = new Date(today);
  const lastWeekStart = new Date(today);
  lastWeekStart.setDate(today.getDate() - 7);

  // 전전주: 지난주 이전 7일
  const previousWeekEnd = new Date(today);
  previousWeekEnd.setDate(today.getDate() - 8);
  const previousWeekStart = new Date(today);
  previousWeekStart.setDate(today.getDate() - 14);

  // 포맷팅: MM/DD
  const formatDate = (date) => `${date.getMonth() + 1}/${date.getDate()}`;

  const lastWeekEl = document.getElementById('lastWeekRange');
  const previousWeekEl = document.getElementById('previousWeekRange');

  if (lastWeekEl) {
    lastWeekEl.textContent = `${formatDate(lastWeekStart)} ~ ${formatDate(lastWeekEnd)}`;
  }
  if (previousWeekEl) {
    previousWeekEl.textContent = `${formatDate(previousWeekStart)} ~ ${formatDate(previousWeekEnd)}`;
  }
}

// 어제 날짜 설정 함수
function setYesterdayDate() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // YYYY-MM-DD 형식으로 변환 (hidden input용)
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  const yesterdayStr = `${year}-${month}-${day}`;

  // 날짜 입력 필드에 기본값 설정 (hidden)
  const dateInput = document.getElementById('screenTimeDate');
  if (dateInput) {
    dateInput.value = yesterdayStr;
  }

  // 요일 배열 (한국어)
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayOfWeek = dayNames[yesterday.getDay()];

  // 표시용 텍스트 업데이트 (예: "12월 4일 (목)")
  const yesterdayDateEl = document.getElementById('yesterdayDate');
  if (yesterdayDateEl) {
    yesterdayDateEl.textContent = `${yesterday.getMonth() + 1}월 ${yesterday.getDate()}일 (${dayOfWeek})`;
  }
}

// 스크린타임 코드 입력 헬퍼 함수들
function getScreenTimeCodeValue() {
  const digits = [];
  for (let i = 1; i <= 4; i++) {
    const digit = document.getElementById(`screenTimeDigit${i}`);
    if (digit && digit.value) {
      digits.push(digit.value);
    }
  }
  return digits.length > 0 ? parseInt(digits.join('')) : NaN;
}

function clearScreenTimeCodeInputs() {
  for (let i = 1; i <= 4; i++) {
    const digit = document.getElementById(`screenTimeDigit${i}`);
    if (digit) {
      digit.value = '';
    }
  }
  updateScreenTimePreview();
}

function updateScreenTimePreview() {
  const preview = document.getElementById('screenTimePreview');
  if (!preview) return;

  const code = getScreenTimeCodeValue();
  if (isNaN(code)) {
    preview.textContent = '';
    return;
  }

  const codeStr = code.toString();
  let hours, minutes;

  const isOver10HoursChecked = document.getElementById('isOver10Hours')?.checked || false;

  if (codeStr.length === 4) {
    // 4자리: 첫 2자리가 시간, 뒤 2자리가 분
    hours = parseInt(codeStr.substring(0, 2));
    minutes = parseInt(codeStr.substring(2, 4));
  } else if (codeStr.length === 3) {
    if (isOver10HoursChecked) {
      // 10시간 이상: 첫 2자리가 시간, 마지막 1자리가 분
      hours = parseInt(codeStr.substring(0, 2));
      minutes = parseInt(codeStr.substring(2, 3));
    } else {
      // 10시간 미만: 첫 1자리가 시간, 뒤 2자리가 분
      hours = parseInt(codeStr.substring(0, 1));
      minutes = parseInt(codeStr.substring(1, 3));
    }
  } else if (codeStr.length === 2) {
    // 2자리: 분만 (에러 검사는 저장 시 수행)
    hours = 0;
    minutes = code;
  } else if (codeStr.length === 1) {
    // 1자리: 분만 (입력 중이므로 미리보기만)
    hours = 0;
    minutes = code;
  } else {
    preview.textContent = '';
    return;
  }

  // 3자리 이상일 때만 분 에러 표시 (2자리 이하 입력 중에는 UX 저해)
  if (minutes >= 60) {
    preview.textContent = '⚠️ 분은 59 이하여야 합니다';
    preview.style.color = '#EF4444';
  } else if (hours >= 24) {
    preview.textContent = '⚠️ 24시간을 넘을 수 없습니다';
    preview.style.color = '#EF4444';
  } else {
    preview.textContent = `📱 ${hours}시간 ${minutes}분`;
    preview.style.color = '#4F46E5';
  }
}

function setupScreenTimeCodeInputs() {
  const digitInputs = [];
  for (let i = 1; i <= 4; i++) {
    const input = document.getElementById(`screenTimeDigit${i}`);
    if (input) {
      digitInputs.push(input);
    }
  }

  digitInputs.forEach((input, index) => {
    // 숫자만 입력 허용
    input.addEventListener('input', (e) => {
      const value = e.target.value;
      // 숫자가 아니면 제거
      if (!/^\d*$/.test(value)) {
        e.target.value = value.replace(/\D/g, '');
        return;
      }

      // 값이 입력되면 다음 칸으로 이동
      if (value && index < digitInputs.length - 1) {
        digitInputs[index + 1].focus();
      }

      updateScreenTimePreview();
    });

    // 백스페이스: 이전 칸으로 이동
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        // 현재 칸이 비어있으면 이전 칸으로 이동하고 그 값을 지움
        if (!e.target.value && index > 0) {
          digitInputs[index - 1].focus();
          digitInputs[index - 1].value = '';
        }
        // 약간의 딜레이 후 프리뷰 업데이트 (값이 지워진 후에 업데이트)
        setTimeout(() => updateScreenTimePreview(), 0);
      }
      // 왼쪽 화살표
      if (e.key === 'ArrowLeft' && index > 0) {
        e.preventDefault();
        digitInputs[index - 1].focus();
      }
      // 오른쪽 화살표
      if (e.key === 'ArrowRight' && index < digitInputs.length - 1) {
        e.preventDefault();
        digitInputs[index + 1].focus();
      }
    });

    // 붙여넣기 처리
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);

      for (let i = 0; i < pastedData.length && (index + i) < digitInputs.length; i++) {
        digitInputs[index + i].value = pastedData[i];
      }

      // 마지막 입력된 칸의 다음 칸으로 포커스 이동
      const nextIndex = Math.min(index + pastedData.length, digitInputs.length - 1);
      digitInputs[nextIndex].focus();

      updateScreenTimePreview();
    });

    // 포커스 시 전체 선택
    input.addEventListener('focus', () => {
      input.select();
    });
  });

  // 10시간 이상 체크박스 변경 시 미리보기 업데이트
  const isOver10HoursCheckbox = document.getElementById('isOver10Hours');
  if (isOver10HoursCheckbox) {
    isOver10HoursCheckbox.addEventListener('change', updateScreenTimePreview);
  }
}

// 스크린타임 저장 버튼
const submitScreenTimeBtn = document.getElementById('submitScreenTimeBtn');
if (submitScreenTimeBtn) {
  submitScreenTimeBtn.addEventListener('click', async () => {
    try {
      // 게스트 모드 체크 (가장 먼저)
      if (window.isGuest()) {
        showToast('체험 모드에서는 저장할 수 없습니다.');
        return;
      }

      const userId = window.getCurrentUserId ? window.getCurrentUserId() : null;
      if (!userId) {
        showToast('로그인이 필요합니다.');
        return;
      }

      // 입력값 가져오기
      const dateInput = document.getElementById('screenTimeDate').value;
      const usageCodeInput = getScreenTimeCodeValue();
      const isOver10HoursChecked = document.getElementById('isOver10Hours').checked;

      // 유효성 검사
      if (!dateInput) {
        showToast('날짜를 선택해주세요.');
        return;
      }

      if (isNaN(usageCodeInput) || usageCodeInput < 0) {
        showToast('사용 시간을 올바르게 입력해주세요.');
        return;
      }

      // 코드 자릿수 확인 (2-4자리)
      const codeStr = usageCodeInput.toString();
      if (codeStr.length < 2) {
        showToast('최소 2자리 이상 입력해주세요.\n(예: 35 = 35분, 135 = 1시간 35분)');
        return;
      }
      if (codeStr.length > 4) {
        showToast('사용 시간은 최대 4자리 숫자로 입력해주세요.\n(예: 1035 = 10시간 35분)');
        return;
      }

      // 10시간 이상 여부: 체크박스 우선, 또는 4자리 숫자 자동 판별
      const isOver10Hours = isOver10HoursChecked || usageCodeInput >= 1000;

      console.log('스크린타임 저장 요청:', {
        date: dateInput,
        usageCode: usageCodeInput,
        isOver10Hours: isOver10Hours
      });

      // usageCode 방식으로 API 호출 (백엔드에서 파싱 및 보상 처리)
      const headers = await getAuthHeaders();
      const response = await fetch('/api/screen-time', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          date: dateInput,
          usageCode: usageCodeInput,
          isOver10Hours: isOver10Hours
        })
      });

      let data = null;
      let error = null;

      if (response.ok) {
        const result = await response.json();
        data = result.data || result;
      } else {
        const errResult = await response.json();
        error = { message: errResult.error || 'Failed to save screen time' };
      }

      if (error) {
        console.error('스크린타임 저장 오류:', error);
        showToast(error.message);
        return;
      }

      console.log('스크린타임 저장 성공:', data);

      // 결과 표시
      const resultDiv = document.getElementById('screenTimeResult');
      resultDiv.className = 'result-message result-success';
      resultDiv.style.display = 'block';

      // 보상 정보 렌더링
      let rewardHtml = '';
      if (data.isNewEntry && data.rewards) {
        const rewards = data.rewards;
        const rewardItems = [];

        if (rewards.mysticCharmReceived > 0) {
          rewardItems.push(`신비의 부적 x${rewards.mysticCharmReceived}`);
        }
        if (rewards.rareCandyReceived > 0) {
          rewardItems.push(`이상한 사탕 x${rewards.rareCandyReceived}`);
        }
        if (rewards.ovalCharmReceived > 0) {
          rewardItems.push(`둥근 부적 x${rewards.ovalCharmReceived}`);
        }
        if (rewards.shinyCharmReceived > 0) {
          rewardItems.push(`빛나는 부적 x${rewards.shinyCharmReceived}`);
        }
        if (rewards.brillianceCharmReceived > 0) {
          rewardItems.push(`찬란한 부적 x${rewards.brillianceCharmReceived}`);
        }
        if (rewards.basePokemonList && rewards.basePokemonList.length > 0) {
          rewardItems.push(`기초 포켓몬 ${rewards.basePokemonList.length}마리`);
        }
        if (rewards.legendaryPokemon) {
          rewardItems.push(`전설 포켓몬 획득!`);
        }
        if (rewards.mythicalPokemon) {
          rewardItems.push(`환상 포켓몬 획득!`);
        }
        if (rewards.specialDayPokemon) {
          rewardItems.push(`특별 보상 포켓몬!`);
        }

        if (rewardItems.length > 0) {
          rewardHtml = `<br><strong>🎁 보상:</strong> ${rewardItems.join(', ')}`;
        }
      }

      // 전주 비교 정보
      let comparisonHtml = '';
      if (data.weeklyComparison && data.weeklyComparison.comparisonResult) {
        comparisonHtml = `<br><small>📊 ${data.weeklyComparison.comparisonResult}</small>`;
      }

      resultDiv.innerHTML = `
          <strong>✅ 저장 완료!</strong><br>
          날짜: ${dateInput}<br>
          📱 ${data.usage?.hours || 0}시간 ${data.usage?.minutes || 0}분
          ${comparisonHtml}
          ${rewardHtml}
        `;

      // 입력 필드 초기화
      clearScreenTimeCodeInputs();
      document.getElementById('isOver10Hours').checked = false;

      // 어제 날짜로 다시 설정
      setYesterdayDate();

      // 5초 후 결과 메시지 숨기기 (보상 있으면 더 오래 표시)
      const hideDelay = rewardHtml ? 5000 : 3000;
      setTimeout(() => {
        resultDiv.style.display = 'none';
      }, hideDelay);

    } catch (err) {
      console.error('스크린타임 저장 중 예외 발생:', err);
      showToast('스크린타임 저장 중 오류가 발생했습니다. 콘솔을 확인하세요.');
    }
  });
}

// 감소율 검증 버튼
const validateReductionBtn = document.getElementById('validateReductionBtn');
if (validateReductionBtn) {
  validateReductionBtn.addEventListener('click', async () => {
    try {
      const userData = { user: window.getCurrentUserId ? { id: window.getCurrentUserId() } : null };
      const userError = null;
      if (!userData?.user) {
        if (window.isGuest()) {
          showToast('체험 모드에서는 검증할 수 없습니다.');
          return;
        }
        showToast('로그인이 필요합니다.');
        return;
      }

      const reductionInput = document.getElementById('reductionPercent');
      const reductionPercent = parseInt(reductionInput.value);

      if (isNaN(reductionPercent) || reductionPercent < 0 || reductionPercent > 100) {
        showToast('0~100 사이의 숫자를 입력해주세요.');
        return;
      }

      // 백엔드 함수 호출 (fetch 사용)
      // validate_screen_time_reduction RPC 대체 필요
      console.warn('Validation API endpoint not implemented yet');
      /*
      const { data, error } = await supabaseClient.rpc('validate_screen_time_reduction', {
          p_user_id: userData.user.id,
          p_claimed_reduction_percent: reductionPercent
      });
      */
      // 임시 에러 처리
      const data = null;
      const error = { message: 'API not implemented' };

      if (error) {
        console.error('검증 오류:', error);
        showToast('검증 중 오류가 발생했습니다: ' + error.message);
        return;
      }

      console.log('검증 결과:', data);

      // 결과 표시
      const resultDiv = document.getElementById('validationResult');
      resultDiv.style.display = 'block';

      if (data.is_fraud) {
        // 부정 기입
        resultDiv.className = 'result-message result-error';
        resultDiv.innerHTML = `
            <strong>⚠️ 부정 기입 감지!</strong><br>
            ${data.message}<br>
            <small>실제 감소율: ${data.actual_reduction_percent}% | 입력한 감소율: ${data.claimed_reduction_percent}%</small>
          `;
      } else if (data.is_valid && data.reward_given) {
        // 검증 성공 + 보상 지급
        resultDiv.className = 'result-message result-success';
        resultDiv.innerHTML = `
            <strong>🎉 검증 성공!</strong><br>
            ${data.message}<br>
            <strong>보상: ${data.reward_item}</strong> 1개 획득!<br>
            <small>실제 감소율: ${data.actual_reduction_percent}%</small>
          `;
      } else if (data.is_valid) {
        // 검증 성공 (보상은 없음)
        resultDiv.className = 'result-message result-info';
        resultDiv.innerHTML = `
            <strong>✓ 검증 성공</strong><br>
            ${data.message}<br>
            <small>실제 감소율: ${data.actual_reduction_percent}%</small>
          `;
      } else {
        // 검증 실패
        resultDiv.className = 'result-message result-warning';
        resultDiv.innerHTML = `
            <strong>❌ 검증 실패</strong><br>
            ${data.message}<br>
            <small>실제 감소율: ${data.actual_reduction_percent}% | 입력한 감소율: ${data.claimed_reduction_percent}%</small><br>
            <small>차이가 ±2% 범위를 벗어났습니다.</small>
          `;
      }

      // 입력 필드 초기화
      reductionInput.value = '';

    } catch (err) {
      console.error('검증 중 예외 발생:', err);
      showToast('검증 중 오류가 발생했습니다. 콘솔을 확인하세요.');
    }
  });
}



// 페이지 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', () => {
  // 스크린타임 코드 입력 셋업
  setupScreenTimeCodeInputs();

  // 스크린타임 관련 리스너 (기존 코드에 있음)
  if (typeof updateWeekRanges === 'function') updateWeekRanges();
  if (typeof setYesterdayDate === 'function') setYesterdayDate();

  // Initialize Tab Navigation
  initTabNavigation();
});

// ==========================================
// Tab Navigation Logic
// ==========================================

function initTabNavigation() {
  const tabItems = document.querySelectorAll('.tab-item');
  const tabViews = document.querySelectorAll('.tab-view');

  if (!tabItems.length || !tabViews.length) {
    console.warn('Tab navigation elements not found.');
    return;
  }

  tabItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();

      // 1. Get the target tab name
      const targetTab = item.closest('.tab-item').dataset.tab;

      if (!targetTab) return;

      // 2. Update Tab Items UI
      tabItems.forEach(tab => {
        if (tab.dataset.tab === targetTab) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });

      // 3. Update Tab Views
      tabViews.forEach(view => {
        if (view.id === `view-${targetTab}`) {
          view.classList.add('active');
          view.style.display = 'block'; // Ensure it's visible

          // Trigger a resize event to ensure layout updates
          window.dispatchEvent(new Event('resize'));

          // Load data for specific tabs
          if (targetTab === 'eggs') {
            if (typeof loadUserEggs === 'function') loadUserEggs();
          }
        } else {
          view.classList.remove('active');
          view.style.display = 'none';
        }
      });

      // PWA 배너 가시성 업데이트
      if (typeof window.updatePwaBannerVisibility === 'function') {
        window.updatePwaBannerVisibility();
      }
    });
  });

  // Initialize: Show the active tab (default to home if none active)
  const activeTab = document.querySelector('.tab-item.active');
  if (activeTab) {
    // Manually trigger the logic for the active tab without full click simulation if preferred,
    // but clicking is the easiest way to ensure all logic runs.
    // However, we need to be careful if the click handler toggles things.
    // Our handler sets state based on the tab, so it's idempotent.
    const targetTab = activeTab.dataset.tab;
    tabViews.forEach(view => {
      if (view.id === `view-${targetTab}`) {
        view.classList.add('active');
        view.style.display = 'block';
      } else {
        view.classList.remove('active');
        view.style.display = 'none';
      }
    });
  }
}

// 게스트 모드 UI 설정 함수
function setupGuestModeUI() {
  // 저장 관련 버튼들에 비활성화 스타일 적용
  const saveButtons = [
    'submitScreenTimeBtn',      // 스크린타임 저장
    'log-session-btn',          // 운동 세션 기록
    'add-exercise-btn',         // 운동 등록
    'validateScreenTimeBtn'     // 스크린타임 검증
  ];

  saveButtons.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.classList.add('guest-disabled');
    }
  });

  // 게스트 모드 안내 배너 표시 (있는 경우)
  const guestBanners = document.querySelectorAll('.guest-mode-banner');
  guestBanners.forEach(banner => banner.classList.add('visible'));

  // 알 획득 관련 UI도 안내 표시
  const eggSearchInput = document.getElementById('eggSearchInput');
  if (eggSearchInput) {
    eggSearchInput.placeholder = '🔍 알 검색 (체험모드: 조회만 가능)';
  }
}

// 게스트 모드 UI 해제 함수 (로그인 시 호출)
function clearGuestModeUI() {
  const saveButtons = [
    'submitScreenTimeBtn',
    'log-session-btn',
    'add-exercise-btn',
    'validateScreenTimeBtn'
  ];

  saveButtons.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.classList.remove('guest-disabled');
    }
  });

  const eggSearchInput = document.getElementById('eggSearchInput');
  if (eggSearchInput) {
    eggSearchInput.placeholder = '🔍 알 검색...';
  }
}
