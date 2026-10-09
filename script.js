// ==========================================
// 0. 파이어베이스 및 파트 목록 설정
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBSRQl0aE1MPZ28LV82Gik4ZVtNUenukqY",
  authDomain: "dasarowon-duty.firebaseapp.com",
  projectId: "dasarowon-duty",
  storageBucket: "dasarowon-duty.appspot.com",
  messagingSenderId: "988864759421",
  appId: "1:988864759421:web:384e950ff06100d0b9d314",
  measurementId: "G-EPBYBDCQJX"
};

// 파이어베이스 초기화
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// ==========================================
// 1. 파트 목록 (무선, 고객, 유선1, 유선2) 및 공휴일 정의
// ==========================================
const parts = ['무선', '고객', '유선1', '유선2'];

// 주요 법정 공휴일 목록 (MM-DD: 공휴일명)
const holidays = {
  '01-01': '신정',
  '03-01': '삼일절',
  '05-05': '어린이날',
  '06-06': '현충일',
  '08-15': '광복절',
  '10-03': '개천절',
  '10-09': '한글날',
  '12-25': '크리스마스'
};

// 당직자 데이터 저장 배열
let dutyList = [];

// ==========================================
// 🌟 접속 시 최초 1회 관리자 인증 함수
// ==========================================
const checkAdminAuthOnStart = () => {
  // 이미 세션에 인증 기록이 있다면 패스
  if (sessionStorage.getItem('isAdminAuth') === 'true') {
    return;
  }

  while (true) {
    const password = prompt('관리자 비밀번호를 입력하세요:');
    if (password === '0070') { // 원하시는 비밀번호 설정
      sessionStorage.setItem('isAdminAuth', 'true');
      alert('관리자 인증이 완료되었습니다!');
      break;
    } else {
      alert('비밀번호가 틀렸습니다! 다시 입력해주세요.');
    }
  }
};

// ==========================================
// 2. 날짜 텍스트 및 요일 / 아래 줄 공휴일 서식
// ==========================================
const formatFormattedDate = (dateString) => {
  const date = new Date(dateString);
  const dayIndex = date.getDay(); // 0: 일, 1: 월 ... 6: 토
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const monthDay = dateString.substring(5);

  let holidayName = holidays[monthDay];

  // 대체 공휴일 자동 계산
  if (!holidayName && dayIndex === 1) {  
    const targetHolidays = ['03-01', '05-05', '08-15', '10-03', '10-09', '12-25'];
    
    const yesterday = new Date(date);
    yesterday.setDate(date.getDate() - 1);
    const yesterdayMd = String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');
    
    const dayBefore = new Date(date);
    dayBefore.setDate(date.getDate() - 2);
    const dayBeforeMd = String(dayBefore.getMonth() + 1).padStart(2, '0') + '-' + String(dayBefore.getDate()).padStart(2, '0');

    if (targetHolidays.includes(yesterdayMd) || targetHolidays.includes(dayBeforeMd)) {
      holidayName = '대체공휴일';
    }
  }

  let colorClass = 'date-normal';
  if (dayIndex === 0 || holidayName) {
    colorClass = 'date-sun-holiday';
  } else if (dayIndex === 6) {
    colorClass = 'date-sat';
  }

  let displayHtml = `${dateString} (${days[dayIndex]})`;
  if (holidayName) {
    displayHtml += `<br><span class="holiday-name">${holidayName}</span>`;
  }

  return `<div class="date-cell-box ${colorClass}">${displayHtml}</div>`;
};

// ==========================================
// 3. 다중 당직자 이름 태그 생성 (클릭 시 개별 삭제 & 세로 줄바꿈)
// ==========================================
const formatWorkers = (workers, date, part) => {
  let workerList = [];
  if (Array.isArray(workers)) {
    workerList = workers;
  } else if (workers && workers !== '-' && String(workers).trim() !== '') {
    workerList = [workers];
  }

  if (workerList.length === 0) return '-';

  return workerList.map((name, index) => `
    <span class="name-tag" onclick="confirmDeleteWorker('${date}', '${part}', ${index}, '${name}')" title="클릭시 삭제" style="margin-bottom: 4px; display: inline-block;">
      ${name}
    </span>
  `).join('<br>');
};

// ==========================================
// 4. 이름 클릭 시 삭제 확인 팝업창 (비번 생략)
// ==========================================
const confirmDeleteWorker = (date, part, index, name) => {
  if (confirm(`${name} 님을 삭제하시겠습니까?`)) {
    deleteSingleWorker(date, part, index);
  }
};

// ==========================================
// 5. 표 화면에 그려주는 함수 (전체 스케줄 표시 + 오늘 날짜 중앙 자동 스크롤)
// ==========================================
const renderTable = () => {
  const tbody = document.getElementById('dutyTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (dutyList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding: 20px; color: #777;">등록된 당직 정보가 없습니다.</td></tr>`;
    return;
  }

  let todayRowElement = null;

  // 한국 시간(YYYY-MM-DD) 기준으로 오늘 날짜 정확히 구하기
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayString = `${year}-${month}-${day}`; // 예: "2026-10-09"

  // 전체 스케줄 렌더링
  dutyList.forEach((item) => {
    const tr = document.createElement('tr');
    
    // 오늘 날짜 행 체크 및 하이라이트
    if (item.date === todayString) {
      tr.id = 'today-row';
      tr.style.backgroundColor = '#e8f4fd'; // 연한 하늘색 하이라이트
    }

    const dateHtml = formatFormattedDate(item.date);
    let partsHtml = parts.map(p => `<td>${formatWorkers(item[p], item.date, p)}</td>`).join('');

    tr.innerHTML = `
      <td>${dateHtml}</td>
      ${partsHtml}
    `;
    tbody.appendChild(tr);

    if (item.date === todayString) {
      todayRowElement = tr;
    }
  });

  // 🌟 연파란색으로 표시된 오늘 날짜 행이 무조건 스크롤 박스 정중앙에 오도록 이동
  setTimeout(() => {
    if (todayRowElement) {
      todayRowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);
};

// ==========================================
// 🔄 파이어베이스 연동: 실시간 데이터 감시
// ==========================================
const loadDutyDataRealtime = () => {
  db.collection("duties").orderBy("date", "asc").onSnapshot((snapshot) => {
    dutyList = [];
    snapshot.forEach((doc) => {
      dutyList.push({ id: doc.id, ...doc.data() });
    });
    renderTable();
  }, (error) => {
    console.error("실시간 동기화 오류: ", error);
  });
};

// ==========================================
// 6. 특정 당직자 개별 삭제 함수 (비번 검사 제거)
// ==========================================
const deleteSingleWorker = (date, part, index) => {
  let targetData = dutyList.find(item => item.date === date);

  if (targetData) {
    let workerList = Array.isArray(targetData[part]) ? targetData[part] : (targetData[part] && targetData[part] !== '-' ? [targetData[part]] : []);
    
    // 해당 인덱스의 인물 제거
    workerList.splice(index, 1);
    targetData[part] = workerList;

    // 모든 파트가 완전히 비었는지 확인
    const isEmpty = parts.every(p => {
      const list = targetData[p];
      return !list || (Array.isArray(list) && list.length === 0) || list
