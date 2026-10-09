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
// 4. 이름 클릭 시 삭제 확인 팝업창
// ==========================================
const confirmDeleteWorker = (date, part, index, name) => {
  if (confirm(`${name} 님을 삭제하시겠습니까?`)) {
    deleteSingleWorker(date, part, index);
  }
};

// ==========================================
// 5. 표 화면에 그려주는 함수 (오늘 날짜 정확한 중앙 자동 스크롤)
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

  // 🌟 한국 시간(YYYY-MM-DD) 기준으로 오늘 날짜 정확히 구하기
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

  // 🌟 표가 완전히 그려진 후 확실하게 스크롤 이동 (지연 시간 100ms 부여)
  setTimeout(() => {
    const container = document.querySelector('.table-responsive');
    if (container) {
      if (todayRowElement) {
        // 오늘 날짜가 있으면 그 위치를 스크롤 박스 중앙에 배치
        container.scrollTop = todayRowElement.offsetTop - container.offsetTop - (container.clientHeight / 2) + (todayRowElement.clientHeight / 2);
      } else {
        // 만약 오늘 날짜 데이터가 아예 없다면 맨 아래(가장 최신 미래 날짜 쪽)로 스크롤 이동
        container.scrollTop = container.scrollHeight;
      }
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
// 6. 특정 당직자 개별 삭제 함수 (파이어베이스 반영)
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
      return !list || (Array.isArray(list) && list.length === 0) || list === '-';
    });

    if (isEmpty) {
      db.collection("duties").doc(date).delete().catch(err => console.error(err));
    } else {
      db.collection("duties").doc(date).set(targetData).catch(err => console.error(err));
    }
  }
};

// ==========================================
// 7. 개별 직접 등록 함수 (파이어베이스 저장 - 다중 추가 지원)
// ==========================================
const addDuty = () => {
  const dateInput = document.getElementById('dutyDate');
  const partSelect = document.getElementById('partSelect');
  const workerInput = document.getElementById('workerName');

  const dateValue = dateInput ? dateInput.value : '';
  const partValue = partSelect ? partSelect.value : '';
  const nameValue = workerInput ? workerInput.value.trim() : '';

  if (!dateValue || !nameValue) {
    alert('날짜와 당직자 이름을 모두 입력해 주세요!');
    return;
  }

  let existingData = dutyList.find(item => item.date === dateValue);
  let newData = existingData ? { ...existingData } : { date: dateValue };

  if (!existingData) {
    parts.forEach(p => { newData[p] = []; });
  }

  // 기존 파트 데이터 배열 보정
  if (!Array.isArray(newData[partValue])) {
    newData[partValue] = newData[partValue] && newData[partValue] !== '-' ? [newData[partValue]] : [];
  }

  // 새로운 당직자 추가 (중복 허용)
  newData[partValue].push(nameValue);

  db.collection("duties").doc(dateValue).set(newData)
    .then(() => {
      if (workerInput) workerInput.value = '';
    })
    .catch((error) => {
      console.error("저장 실패: ", error);
      alert('저장에 실패했습니다.');
    });
};

// ==========================================
// 8. 엑셀 파일 업로드 처리 함수 (파이어베이스 저장)
// ==========================================
const uploadExcel = () => {
  const fileInput = document.getElementById('excelFile');
  const file = fileInput.files ? fileInput.files[0] : null;

  if (!file) {
    alert('업로드할 엑셀 파일을 먼저 선택해 주세요!');
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const excelData = XLSX.utils.sheet_to_json(worksheet);

    if (excelData.length === 0) {
      alert('엑셀 파일에 데이터가 없습니다.');
      return;
    }

    const batch = db.batch();

    excelData.forEach(row => {
      let formattedDate = row['날짜'];
      if (!formattedDate) return;

      // 엑셀 시리얼 날짜 변환 보정
      if (typeof formattedDate === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        const jsDate = new Date(excelEpoch.getTime() + formattedDate * 86400000);
        formattedDate = jsDate.toISOString().split('T')[0];
      }

      const dateStr = String(formattedDate);
      let existingData = dutyList.find(item => item.date == dateStr);
      let newData = existingData ? { ...existingData } : { date: dateStr };

      if (!existingData) {
        parts.forEach(p => { newData[p] = []; });
      }

      parts.forEach(p => {
        if (row[p] !== undefined && row[p] !== null && row[p] !== '') {
          const names = String(row[p]).split(',').map(s => s.trim()).filter(s => s);
          newData[p] = names;
        } else if (!newData[p]) {
          newData[p] = [];
        }
      });

      const docRef = db.collection("duties").doc(dateStr);
      batch.set(docRef, newData);
    });

    batch.commit().then(() => {
      alert(`총 ${excelData.length}건의 당직 데이터가 클라우드에 반영되었습니다!`);
      if (fileInput) fileInput.value = '';
    }).catch(err => {
      console.error("엑셀 일괄 업로드 저장 오류:", err);
      alert('엑셀 업로드 중 오류가 발생했습니다.');
    });
  };

  reader.readAsArrayBuffer(file);
};

// ==========================================
// 9. 초기화 및 실시간 감시 시작
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const excelBtn = document.getElementById('excelBtn');
  const registerBtn = document.getElementById('registerBtn');
  const dutyDateInput = document.getElementById('dutyDate');

  if (excelBtn) excelBtn.addEventListener('click', uploadExcel);
  if (registerBtn) registerBtn.addEventListener('click', addDuty);
  
  // 🌟 한국 시간(KST) 기준으로 날짜 선택(input) 기본값 오늘로 설정
  if (dutyDateInput && !dutyDateInput.value) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    dutyDateInput.value = `${year}-${month}-${day}`;
  }

  // 실시간 데이터 로드 시작
  loadDutyDataRealtime();
});
