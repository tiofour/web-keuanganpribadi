const formatRupiah = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
const formatTanggal = (str) => new Date(str).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const formatTanggalInput = (str) => new Date(str).toISOString().split('T')[0];

let aliranChart;

// Fungsi khusus untuk mengecek Auth. Jika error 403, lempar ke login
async function safeFetch(url, options = {}) {
    const response = await fetch(url, options);
    if (response.status === 403) {
        window.location.href = '/login.html';
        throw new Error("Sesi habis, silakan login.");
    }
    return response;
}

async function loadDashboardAndChart() {
    try {
        const resDash = await safeFetch('/api/dashboard');
        const dataDash = await resDash.json();
        
        document.getElementById('dash-pemasukan').innerText = formatRupiah(dataDash.pemasukan);
        document.getElementById('dash-pengeluaran').innerText = formatRupiah(dataDash.pengeluaran);
        document.getElementById('dash-saldo').innerText = formatRupiah(dataDash.saldo);

        const resAll = await safeFetch('/api/transaksi?filter=semua');
        const dataAll = await resAll.json();
        renderChart(dataAll);
        
        // Buka layar utama setelah lolos pengecekan
        document.getElementById('auth-overlay').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
    } catch (error) {
        console.error(error);
    }
}

function renderChart(data) {
    const ctx = document.getElementById('aliranChart').getContext('2d');
    const bulanLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    const dataPemasukan = new Array(12).fill(0);
    const dataPengeluaran = new Array(12).fill(0);

    data.forEach(item => {
        const date = new Date(item.tanggal);
        const bulanIndex = date.getMonth(); 
        if (item.jenis === 'Pemasukan') dataPemasukan[bulanIndex] += item.jumlah;
        else dataPengeluaran[bulanIndex] += item.jumlah;
    });

    if (aliranChart) aliranChart.destroy();

    aliranChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: bulanLabels,
            datasets: [
                { label: 'Pemasukan', data: dataPemasukan, backgroundColor: '#10b981', borderRadius: 4 },
                { label: 'Pengeluaran', data: dataPengeluaran, backgroundColor: '#ef4444', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } },
            plugins: { legend: { position: 'top', align: 'end' } }
        }
    });
}

async function loadTransaksi(filter = 'semua') {
    try {
        const response = await safeFetch(`/api/transaksi?filter=${filter}`);
        const data = await response.json();
        const tabel = document.getElementById('tabel-transaksi');
        tabel.innerHTML = ''; 

        if(data.length === 0) {
            tabel.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-400">Tidak ada transaksi ditemukan.</td></tr>`;
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
                        <button onclick='siapkanEdit(${JSON.stringify(item)})' class="text-blue-500 font-semibold">Edit</button>
                        <button onclick="hapusTransaksi(${item.id})" class="text-red-400 font-semibold">Hapus</button>
                    </td>
                </tr>
            `;
            tabel.innerHTML += row;
        });
    } catch (error) {
        console.error(error);
    }
}

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

async function hapusTransaksi(id) {
    if(confirm("Yakin ingin menghapus transaksi ini?")) {
        await safeFetch(`/api/transaksi/${id}`, { method: 'DELETE' });
        refreshSemuaData(); 
    }
}

// Fungsi Logout
document.getElementById('btn-logout').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
});

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

function batalEdit() {
    document.getElementById('form-transaksi').reset();
    document.getElementById('form-title').innerText = "Catat Transaksi";
    document.getElementById('edit-id').value = "";
    document.getElementById('input-tanggal').valueAsDate = new Date(); 
    document.getElementById('btn-simpan').innerText = "Simpan";
    document.getElementById('btn-batal').classList.add('hidden');
}

document.getElementById('btn-batal').addEventListener('click', batalEdit);
document.getElementById('filter-tabel').addEventListener('change', function() { loadTransaksi(this.value); });
function refreshSemuaData() { loadDashboardAndChart(); loadTransaksi(document.getElementById('filter-tabel').value); }

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('input-tanggal').valueAsDate = new Date();
    refreshSemuaData(); // Akan otomatis ngecek auth ke server
});