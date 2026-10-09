// Firebase 설정 (기존에 사용하시던 설정값 그대로 유지)
const firebaseConfig = {
  // 사용 중이신 파이어베이스 설정 객체 내용
};

// Firebase 초기화 확인
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// 페이지 로드 시 데이터 실시간 불러오기 실행
document.addEventListener("DOMContentLoaded", () => {
  loadDutiesRealtime();
  
  // 오늘 날짜 기본 세팅
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('dutyDate').value = today;

  // 등록 버튼 이벤트 연결
  document.getElementById('registerBtn').addEventListener('click', registerDuty);
  // 엑셀 업로드 버튼 이벤트 연결
  document.getElementById('excelBtn').addEventListener('click', handleExcelUpload);
});

// 1. 개별 당직 등록 및 추가 (다중 등록 지원)
function registerDuty() {
  const dateStr = document.getElementById('dutyDate').value;
  const part = document.getElementById('partSelect').value;
  const workerName = document.getElementById('workerName').value.trim();

  if (!dateStr || !workerName) {
    alert("날짜와 당직자 이름을 모두 입력해 주세요.");
    return;
  }

  const docRef = db.collection('duties').doc(dateStr);

  db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    let data = doc.exists ? doc.data() : { date: dateStr, 무선: [], 고객: [], 유선1: [], 유선2: [] };

    // 파트별 데이터가 배열이 아닌 경우 대비 (이전 데이터 호환)
    if (!Array.isArray(data[part])) {
      data[part] = data[part] ? [data[part]] : [];
    }

    // 새로운 당직자 추가 (중복 허용 또는 추가)
    data[part].push(workerName);

    transaction.set(docRef, data);
  }).then(() => {
    document.getElementById('workerName').value = '';
    alert("당직자가 성공적으로 추가되었습니다!");
  }).catch((error) => {
    console.error("등록 실패: ", error);
    alert("등록 중 오류가 발생했습니다.");
  });
}

// 2. Firestore 실시간 데이터 동기화 및 테이블 렌더링
function loadDutiesRealtime() {
  const tableBody = document.getElementById('dutyTableBody');

  db.collection('duties').orderBy('date', 'desc').onSnapshot((snapshot) => {
    tableBody.innerHTML = '';

    if (snapshot.empty) {
      tableBody.innerHTML = `<tr><td colspan="5" style="padding: 20px; color: #777;">등록된 당직 정보가 없습니다.</td></tr>`;
      return;
    }

    snapshot.forEach((doc) => {
      const rowData = doc.data();
      const dateStr = rowData.date;

      // 날짜 스타일 (주말/공휴일 판별)
      const dateClassInfo = getFormattedDateHtml(dateStr);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="date-cell-box ${dateClassInfo.className}">${dateClassInfo.html}</td>
        <td>${formatWorkers(rowData.무선, dateStr, '무선')}</td>
        <td>${formatWorkers(rowData.고객, dateStr, '고객')}</td>
        <td>${formatWorkers(rowData.유선1, dateStr, '유선1')}</td>
        <td>${formatWorkers(rowData.유선2, dateStr, '유선2')}</td>
      `;
      tableBody.appendChild(tr);
    });
  });
}

// 당직자 목록을 HTML 태그로 변환 (클릭 시 개별 삭제 기능 포함)
function formatWorkers(workers, dateStr, partKey) {
  if (!workers) return '-';
  
  // 단일 문자열로 저장되어 있던 과거 데이터 대응
  let workerList = Array.isArray(workers) ? workers : [workers];
  if (workerList.length === 0) return '-';

  return workerList.map((name, index) => `
    <span class="name-tag" onclick="removeWorker('${dateStr}', '${partKey}', ${index})" title="클릭시 삭제">${name}</span>
  `).join(' ');
}

// 특정 당직자 개별 삭제 기능
function removeWorker(dateStr, partKey, index) {
  if (!confirm(`'${dateStr}'의 ${partKey} 당직자 중 한 명을 삭제하시겠습니까?`)) return;

  const docRef = db.collection('duties').doc(dateStr);
  db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);
    if (!doc.exists) return;

    let data = doc.data();
    let workerList = Array.isArray(data[partKey]) ? data[partKey] : [data[partKey]];
    
    // 해당 인덱스의 당직자 제거
    workerList.splice(index, 1);
    data[partKey] = workerList;

    transaction.set(docRef, data);
  }).then(() => {
    console.log("당직자 삭제 완료");
  }).catch((error) => {
    console.error("삭제 실패: ", error);
  });
}

// 날짜 포맷 및 주말 색상 처리 함수
function getFormattedDateHtml(dateStr) {
  const dateObj = new Date(dateStr);
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
  
  let className = 'date-normal';
  if (dayOfWeek === '토') className = 'date-sat';
  if (dayOfWeek === '일') className = 'date-sun-holiday';

  return {
    html: `${dateStr} (${dayOfWeek})`,
    className: className
  };
}

// 3. 엑셀 일괄 업로드 처리 로직
function handleExcelUpload() {
  const fileInput = document.getElementById('excelFile');
  const file = fileInput.files[0];

  if (!file) {
    alert("업로드할 엑셀 파일을 선택해 주세요.");
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet);

      if (jsonRows.length === 0) {
        alert("엑셀 파일에 데이터가 없습니다.");
        return;
      }

      const batch = db.batch();
      
      jsonRows.forEach((row) => {
        let dateStr = row['날짜'];
        if (!dateStr) return;

        // 엑셀 날짜 형식 보정 처리
        if (typeof dateStr === 'number') {
          const excelEpoch = new Date(1899, 11, 30);
          const jsDate = new Date(excelEpoch.getTime() + dateStr * 86400000);
          dateStr = jsDate.toISOString().split('T')[0];
        }

        const docRef = db.collection('duties').doc(String(dateStr));
        
        // 엑셀 파일은 파트별 여러 명이 입력되어 있을 경우 쉼표로 구분되어 있다고 가정하거나 배열 처리
        const parsePart = (val) => val ? String(val).split(',').map(s => s.trim()) : [];

        batch.set(docRef, {
          date: String(dateStr),
          무선: parsePart(row['무선']),
          고객: parsePart(row['고객']),
          유선1: parsePart(row['유선1']),
          유선2: parsePart(row['유선2'])
        }, { merge: true });
      });

      await batch.commit();
      alert("엑셀 데이터가 성공적으로 일괄 등록되었습니다!");
      fileInput.value = '';
    } catch (err) {
      console.error("엑셀 업로드 에러: ", err);
      alert("엑셀 파일을 처리하는 중 오류가 발생했습니다. 양식을 확인해 주세요.");
    }
  };
  reader.readAsArrayBuffer(file);
}
