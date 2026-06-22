// Fungsi Helper untuk memformat angka menjadi Rupiah dan memformat Tanggal
const formatRupiah = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
const formatTanggal = (str) => new Date(str).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const formatTanggalInput = (str) => new Date(str).toISOString().split('T')[0];

let aliranChart;

// Fungsi krusial untuk mengecek akses login (wajib membawa credentials sesi)
async function safeFetch(url, options = {}) {
    options.credentials = 'same-origin'; // WAJIB ada agar sesi cookie login terbaca oleh server
    const response = await fetch(url, options);
    if (response.status === 403) {
        window.location.href = '/login.html';
        throw new Error("Sesi habis, silakan login kembali.");
    }
    return response;
}

// Fungsi utama untuk memuat data ringkasan kartu dan data grafik
async function loadDashboardAndChart() {
    try {
        // 1. Ambil data nominal pemasukan, pengeluaran, dan saldo bersih
        const resDash = await safeFetch('/api/dashboard');
        const dataDash = await resDash.json();
        
        document.getElementById('dash-pemasukan').innerText = formatRupiah(dataDash.pemasukan);
        document.getElementById('dash-pengeluaran').innerText = formatRupiah(dataDash.pengeluaran);
        document.getElementById('dash-saldo').innerText = formatRupiah(dataDash.saldo);

        // 2. Ambil seluruh data transaksi untuk diolah menjadi grafik batangan
        const resAll = await safeFetch('/api/transaksi?filter=semua');
        const dataAll = await resAll.json();
        
        // Membaca jenis filter chart apa yang sedang dipilih di dropdown HTML (bulanan/mingguan/harian)
        const filterChartAktif = document.getElementById('filter-chart').value;
        renderChart(dataAll, filterChartAktif);
        
        // Sembunyikan layar loading dan munculkan konten utama dashboard
        document.getElementById('auth-overlay').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
    } catch (e) { console.error(e); }
}

// Fungsi dinamis untuk memproses data dan menggambar Chart.js
function renderChart(data, filterType = 'bulanan') {
    const ctx = document.getElementById('aliranChart').getContext('2d');
    let labels = [];
    let dataPemasukan = [];
    let dataPengeluaran = [];

    const sekarang = new Date();

    // LOGIKA FILTER 1: BULANAN (Januari - Desember)
    if (filterType === 'bulanan') {
        labels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
        dataPemasukan = new Array(12).fill(0);
        dataPengeluaran = new Array(12).fill(0);

        data.forEach(item => {
            const date = new Date(item.tanggal);
            if (date.getFullYear() === sekarang.getFullYear()) {
                const bulanIndex = date.getMonth();
                if (item.jenis === 'Pemasukan') dataPemasukan[bulanIndex] += item.jumlah;
                else dataPengeluaran[bulanIndex] += item.jumlah;
            }
        });
    }
    // LOGIKA FILTER 2: MINGGUAN (Minggu 1 - Minggu 5 di bulan ini)
    else if (filterType === 'mingguan') {
        labels = ['Minggu 1', 'Minggu 2', 'Minggu 3', 'Minggu 4', 'Minggu 5'];
        dataPemasukan = new Array(5).fill(0);
        dataPengeluaran = new Array(5).fill(0);

        data.forEach(item => {
            const date = new Date(item.tanggal);
            if (date.getMonth() === sekarang.getMonth() && date.getFullYear() === sekarang.getFullYear()) {
                const tanggalHari = date.getDate();
                let mingguIndex = Math.floor((tanggalHari - 1) / 7);
                if (mingguIndex > 4) mingguIndex = 4;

                if (item.jenis === 'Pemasukan') dataPemasukan[mingguIndex] += item.jumlah;
                else dataPengeluaran[mingguIndex] += item.jumlah;
            }
        });
    }
    // LOGIKA FILTER 3: HARIAN (Menghitung mundur 7 hari terakhir dari hari ini)
    else if (filterType === 'harian') {
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(sekarang.getDate() - i);
            labels.push(d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));
        }
        dataPemasukan = new Array(7).fill(0);
        dataPengeluaran = new Array(7).fill(0);

        data.forEach(item => {
            const date = new Date(item.tanggal);
            const itemLabel = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
            
            const labelIndex = labels.indexOf(itemLabel);
            if (labelIndex !== -1) {
                if (item.jenis === 'Pemasukan') dataPemasukan[labelIndex] += item.jumlah;
                else dataPengeluaran[labelIndex] += item.jumlah;
            }
        });
    }

    // Gambar ulang grafik ke kanvas HTML
    if (aliranChart) aliranChart.destroy();
    aliranChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Pemasukan', data: dataPemasukan, backgroundColor: '#10b981', borderRadius: 4 },
                { label: 'Pengeluaran', data: dataPengeluaran, backgroundColor: '#ef4444', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { 
                y: { beginAtZero: true, grid: { display: false } }, 
                x: { grid: { display: false } } 
            },
            plugins: { legend: { position: 'top', align: 'end' } }
        }
    });
}

// Fungsi untuk mengambil data tabel berdasarkan filter SQL dari backend
async function loadTransaksi(filter = 'semua') {
    try {
        const response = await safeFetch(`/api/transaksi?filter=${filter}`);
        const data = await response.json();
        const tabel = document.getElementById('tabel-transaksi');
        tabel.innerHTML = ''; 

        if(data.length === 0) {
            tabel.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-400">Tidak ada transaksi terdaftar.</td></tr>`;
            return;
        }

        data.forEach(item => {
            const warnaJenis = item.jenis === 'Pemasukan' ? 'text-green-500' : 'text-red-500';
            const row = `
                <tr class="border-b border-gray-50 hover:bg-white transition">
                    <td class="p-4 text-gray-500">${formatTanggal(item.tanggal)}</td>
                    <td class="p-4 font-medium">${item.keterangan}</td>
                    <td class="p-4 font-semibold ${warnaJenis}">${item.jenis}</td>
                    <td class="p-4 font-bold">${formatRupiah(item.jumlah)}</td>
                    <td class="p-4 text-right space-x-2">
                        <button onclick='siapkanEdit(${JSON.stringify(item)})' class="text-blue-500 font-semibold hover:underline">Edit</button>
                        <button onclick="hapusTransaksi(${item.id})" class="text-red-400 font-semibold hover:underline">Hapus</button>
                    </td>
                </tr>
            `;
            tabel.innerHTML += row;
        });
    } catch (e) { console.error(e); }
}

// Handler submit form untuk Tambah data (POST) maupun Update data (PUT)
document.getElementById('form-transaksi').addEventListener('submit', async function(e) {
    e.preventDefault();
    const idEdit = document.getElementById('edit-id').value;
    const dataKirim = {
        jenis: document.getElementById('input-jenis').value,
        jumlah: document.getElementById('input-jumlah').value,
        keterangan: document.getElementById('input-keterangan').value,
        tanggal: document.getElementById('input-tanggal').value
    };

    const url = idEdit ? `/api/transaksi/${idEdit}` : '/api/transaksi';
    const method = idEdit ? 'PUT' : 'POST';
    const response = await safeFetch(url, {
        method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataKirim)
    });
    if (response.ok) { batalEdit(); refreshSemuaData(); }
});

// Fungsi untuk menghapus transaksi
async function hapusTransaksi(id) {
    if(confirm("Yakin ingin menghapus transaksi ini secara permanen?")) {
        await safeFetch(`/api/transaksi/${id}`, { method: 'DELETE' });
        refreshSemuaData(); 
    }
}

// Fungsi tombol logout
document.getElementById('btn-logout').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
});

// Memindahkan data tabel ke dalam field input form untuk siap diedit
function siapkanEdit(item) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('form-title').innerText = "Edit Transaksi";
    document.getElementById('edit-id').value = item.id;
    document.getElementById('input-jenis').value = item.jenis;
    document.getElementById('input-jumlah').value = item.jumlah;
    document.getElementById('input-keterangan').value = item.keterangan;
    document.getElementById('input-tanggal').value = formatTanggalInput(item.tanggal);
    document.getElementById('btn-simpan').innerText = "Update";
    document.getElementById('btn-batal').classList.remove('hidden');
}

// Mengosongkan form kembali jika tombol batal ditekan
function batalEdit() {
    document.getElementById('form-transaksi').reset();
    document.getElementById('form-title').innerText = "Catat Transaksi";
    document.getElementById('edit-id').value = "";
    document.getElementById('input-tanggal').valueAsDate = new Date(); 
    document.getElementById('btn-simpan').innerText = "Simpan";
    document.getElementById('btn-batal').classList.add('hidden');
}

// =======================================================
// KUMPULAN EVENT LISTENERS DI BAGIAN BAWAH FILE
// =======================================================
document.getElementById('btn-batal').addEventListener('click', batalEdit);

// Listener untuk Dropdown Filter TABEL LOG
document.getElementById('filter-tabel').addEventListener('change', function() { 
    loadTransaksi(this.value); 
});

// BARU (Tahap 2 No 3): Listener untuk Dropdown Filter GRAFIK ALIRAN
document.getElementById('filter-chart').addEventListener('change', function() {
    loadDashboardAndChart(); 
});

// Fungsi pembantu untuk memicu pembaruan seluruh komponen halaman
function refreshSemuaData() { 
    loadDashboardAndChart(); 
    loadTransaksi(document.getElementById('filter-tabel').value); 
}

// Terpicu otomatis sesaat setelah halaman HTML selesai dimuat di browser
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('input-tanggal').valueAsDate = new Date();
    refreshSemuaData(); // Menjalankan proses validasi sesi awal
});