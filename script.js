// ==========================================
// 1. 파트 목록 및 주요 한국 법정 공휴일 정의
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

  // 대체 공휴일 자동 계산 (월요일일 경우 주말 공휴일 여부 확인)
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

  // 색상 지정 (토: 파랑, 일/공휴일: 빨강, 평일: 검정)
  let colorClass = 'date-normal';
  if (dayIndex === 0 || holidayName) {
    colorClass = 'date-sun-holiday';
  } else if (dayIndex === 6) {
    colorClass = 'date-sat';
  }

  // 첫 번째 줄: YYYY-MM-DD (요일)
  // 두 번째 줄: 공휴일명
  let displayHtml = `${dateString} (${days[dayIndex]})`;
  if (holidayName) {
    displayHtml += `<br><span class="holiday-name">${holidayName}</span>`;
  }

  return `<div class="date-cell-box ${colorClass}">${displayHtml}</div>`;
};

// ==========================================
// 3. 당직자 이름 태그 생성 (클릭 이벤트 포함)
// ==========================================
const formatNameTag = (date, part, name) => {
  if (!name || name === '-' || name.trim() === '') return '-';
  return `
    <span class="name-tag" onclick="confirmDeleteWorker('${date}', '${part}', '${name}')">
      ${name}
    </span>
  `;
};

// ==========================================
// 4. 이름 클릭 시 삭제 확인 팝업창
// ==========================================
const confirmDeleteWorker = (date, part, name) => {
  if (confirm(`${name} 님을 삭제하시겠습니까?`)) {
    deleteSingleWorker(date, part);
  }
};

// ==========================================
// 5. 표 화면에 그려주는 함수
// ==========================================
const renderTable = () => {
  const tbody = document.getElementById('dutyTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  dutyList.forEach((item) => {
    const tr = document.createElement('tr');
    const dateHtml = formatFormattedDate(item.date);

    let partsHtml = parts.map(p => `<td>${formatNameTag(item.date, p, item[p])}</td>`).join('');

    tr.innerHTML = `
      <td>${dateHtml}</td>
      ${partsHtml}
    `;
    tbody.appendChild(tr);
  });
};

// ==========================================
// 6. 특정 파트 당직자 삭제 함수
// ==========================================
const deleteSingleWorker = (date, part) => {
  let targetData = dutyList.find(item => item.date === date);

  if (targetData) {
    targetData[part] = '-';

    const isEmpty = parts.every(p => !targetData[p] || targetData[p] === '-');
    if (isEmpty) {
      dutyList = dutyList.filter(item => item.date !== date);
    }

    renderTable();
  }
};

// ==========================================
// 7. 개별 직접 등록 함수
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

  if (existingData) {
    existingData[partValue] = nameValue;
  } else {
    const newData = { date: dateValue };
    parts.forEach(p => { newData[p] = '-'; });
    newData[partValue] = nameValue;
    dutyList.push(newData);
  }

  dutyList.sort((a, b) => new Date(a.date) - new Date(b.date));
  workerInput.value = '';
  renderTable();
};

// ==========================================
// 8. 엑셀 파일 업로드 처리 함수
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

    excelData.forEach(row => {
      let formattedDate = row['날짜'];
      if (!formattedDate) return;

      let existingData = dutyList.find(item => item.date == formattedDate);

      if (existingData) {
        parts.forEach(p => {
          if (row[p]) existingData[p] = row[p];
        });
      } else {
        let newData = { date: String(formattedDate) };
        parts.forEach(p => {
          newData[p] = row[p] || '-';
        });
        dutyList.push(newData);
      }
    });

    dutyList.sort((a, b) => new Date(a.date) - new Date(b.date));
    renderTable();
    alert(`총 ${excelData.length}건의 당직 데이터가 등록되었습니다!`);
    fileInput.value = '';
  };

  reader.readAsArrayBuffer(file);
};

// ==========================================
// 9. 초기화 및 이벤트 연결
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const excelBtn = document.getElementById('excelBtn');
  const registerBtn = document.getElementById('registerBtn');
  const dutyDateInput = document.getElementById('dutyDate');

  if (excelBtn) excelBtn.addEventListener('click', uploadExcel);
  if (registerBtn) registerBtn.addEventListener('click', addDuty);
  if (dutyDateInput) dutyDateInput.value = new Date().toISOString().substring(0, 10);

  renderTable();
});