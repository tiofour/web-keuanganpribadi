// Konfigurasi Format
const formatRupiah = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
const formatTanggal = (str) => new Date(str).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const formatTanggalInput = (str) => new Date(str).toISOString().split('T')[0];

// Variabel Global untuk Chart.js
let aliranChart;

// 1. Muat Dashboard & Chart Dinamis
async function loadDashboardAndChart() {
    try {
        // Ambil data untuk Dashboard (Ringkasan)
        const resDash = await fetch('/api/dashboard');
        const dataDash = await resDash.json();
        
        document.getElementById('dash-pemasukan').innerText = formatRupiah(dataDash.pemasukan);
        document.getElementById('dash-pengeluaran').innerText = formatRupiah(dataDash.pengeluaran);
        document.getElementById('dash-saldo').innerText = formatRupiah(dataDash.saldo);

        // Ambil SEMUA data transaksi untuk menggambar Grafik (Chart.js)
        const resAll = await fetch('/api/transaksi?filter=semua');
        const dataAll = await resAll.json();
        
        renderChart(dataAll);
    } catch (error) {
        console.error("Gagal memuat dashboard:", error);
    }
}

// Fungsi Render Chart.js (Otomatis menyesuaikan data)
function renderChart(data) {
    const ctx = document.getElementById('aliranChart').getContext('2d');
    
    // Inisialisasi array bulan (Januari - Desember)
    const bulanLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    const dataPemasukan = new Array(12).fill(0);
    const dataPengeluaran = new Array(12).fill(0);

    // Kelompokkan data transaksi ke dalam bulan masing-masing
    data.forEach(item => {
        const date = new Date(item.tanggal);
        const bulanIndex = date.getMonth(); // 0 untuk Jan, 11 untuk Des
        
        if (item.jenis === 'Pemasukan') {
            dataPemasukan[bulanIndex] += item.jumlah;
        } else {
            dataPengeluaran[bulanIndex] += item.jumlah;
        }
    });

    // Jika chart sudah ada sebelumnya, hancurkan dulu sebelum digambar ulang agar bisa update dinamis
    if (aliranChart) {
        aliranChart.destroy();
    }

    // Gambar Chart baru
    aliranChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: bulanLabels,
            datasets: [
                {
                    label: 'Pemasukan',
                    data: dataPemasukan,
                    backgroundColor: '#10b981', // green-accent
                    borderRadius: 4
                },
                {
                    label: 'Pengeluaran',
                    data: dataPengeluaran,
                    backgroundColor: '#ef4444', // red-accent
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { position: 'top', align: 'end' }
            }
        }
    });
}

// 2. Muat Tabel Transaksi dengan Filter
async function loadTransaksi(filter = 'semua') {
    try {
        const response = await fetch(`/api/transaksi?filter=${filter}`);
        const data = await response.json();
        
        const tabel = document.getElementById('tabel-transaksi');
        tabel.innerHTML = ''; 

        if(data.length === 0) {
            tabel.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-400">Tidak ada transaksi ditemukan.</td></tr>`;
            return;
        }

        data.forEach(item => {
            const warnaJenis = item.jenis === 'Pemasukan' ? 'text-green-accent' : 'text-red-accent';
            
            const row = `
                <tr class="border-b border-gray-50 hover:bg-white transition">
                    <td class="p-4 text-gray-500">${formatTanggal(item.tanggal)}</td>
                    <td class="p-4 font-medium text-secondary">${item.keterangan}</td>
                    <td class="p-4 font-semibold ${warnaJenis}">${item.jenis}</td>
                    <td class="p-4 font-bold text-secondary">${formatRupiah(item.jumlah)}</td>
                    <td class="p-4 text-right space-x-2">
                        <button onclick='siapkanEdit(${JSON.stringify(item)})' class="text-blue-500 hover:text-blue-700 text-sm font-semibold">Edit</button>
                        <button onclick="hapusTransaksi(${item.id})" class="text-red-400 hover:text-red-600 text-sm font-semibold">Hapus</button>
                    </td>
                </tr>
            `;
            tabel.innerHTML += row;
        });
    } catch (error) {
        console.error("Gagal memuat transaksi:", error);
    }
}

// 3. Tambah / Edit Data Transaksi (Submit Form)
document.getElementById('form-transaksi').addEventListener('submit', async function(e) {
    e.preventDefault();

    const idEdit = document.getElementById('edit-id').value;
    const dataKirim = {
        jenis: document.getElementById('input-jenis').value,
        jumlah: document.getElementById('input-jumlah').value,
        keterangan: document.getElementById('input-keterangan').value,
        tanggal: document.getElementById('input-tanggal').value
    };

    try {
        // Tentukan URL dan Method (Jika ada idEdit, berarti PUT/Update. Jika tidak, POST/Tambah Baru)
        const url = idEdit ? `/api/transaksi/${idEdit}` : '/api/transaksi';
        const method = idEdit ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataKirim)
        });

        if (response.ok) {
            batalEdit(); // Reset form
            refreshSemuaData(); // Render ulang grafik & tabel
        }
    } catch (error) {
        console.error("Error submit transaksi:", error);
    }
});

// 4. Fungsi Hapus Transaksi
async function hapusTransaksi(id) {
    // Validasi konfirmasi ke pengguna
    if(confirm("Apakah Anda yakin ingin menghapus transaksi ini?")) {
        try {
            await fetch(`/api/transaksi/${id}`, { method: 'DELETE' });
            refreshSemuaData(); // Render ulang grafik & tabel
        } catch (error) {
            console.error("Gagal menghapus:", error);
        }
    }
}

// 5. Fungsi Memasukkan Data ke Form untuk Mode Edit
function siapkanEdit(item) {
    // Scroll ke form secara halus
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    document.getElementById('form-title').innerText = "Edit Transaksi";
    document.getElementById('edit-id').value = item.id;
    document.getElementById('input-jenis').value = item.jenis;
    document.getElementById('input-jumlah').value = item.jumlah;
    document.getElementById('input-keterangan').value = item.keterangan;
    document.getElementById('input-tanggal').value = formatTanggalInput(item.tanggal);
    
    document.getElementById('btn-simpan').innerText = "Update Transaksi";
    document.getElementById('btn-batal').classList.remove('hidden');
}

// 6. Fungsi Membatalkan Mode Edit
function batalEdit() {
    document.getElementById('form-transaksi').reset();
    document.getElementById('form-title').innerText = "Catat Transaksi";
    document.getElementById('edit-id').value = "";
    document.getElementById('input-tanggal').valueAsDate = new Date(); // Reset ke hari ini
    
    document.getElementById('btn-simpan').innerText = "Simpan";
    document.getElementById('btn-batal').classList.add('hidden');
}

// Tombol Batal diklik
document.getElementById('btn-batal').addEventListener('click', batalEdit);

// Filter Tabel diganti
document.getElementById('filter-tabel').addEventListener('change', function() {
    loadTransaksi(this.value);
});

// Helper: Refresh Semua Data
function refreshSemuaData() {
    loadDashboardAndChart();
    loadTransaksi(document.getElementById('filter-tabel').value);
}

// Inisialisasi awal saat halaman dimuat
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('input-tanggal').valueAsDate = new Date();
    refreshSemuaData();
});