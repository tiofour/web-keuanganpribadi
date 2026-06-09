const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Konfigurasi Database (Sesuaikan user/password jika perlu)
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'keuanganpribadi_db'
});

// ==========================================
// ROUTING API BACKEND (CRUD LENGKAP)
// ==========================================

// 1. READ: Data Dashboard
app.get('/api/dashboard', (req, res) => {
    const query = "SELECT jenis, SUM(jumlah) as total FROM transaksi GROUP BY jenis";
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        let totalPemasukan = 0;
        let totalPengeluaran = 0;

        results.forEach(row => {
            if (row.jenis === 'Pemasukan') totalPemasukan = Number(row.total);
            if (row.jenis === 'Pengeluaran') totalPengeluaran = Number(row.total);
        });

        res.json({
            pemasukan: totalPemasukan,
            pengeluaran: totalPengeluaran,
            saldo: totalPemasukan - totalPengeluaran
        });
    });
});

// 2. CREATE: Tambah Transaksi
app.post('/api/transaksi', (req, res) => {
    const { jenis, jumlah, keterangan, tanggal } = req.body;
    const query = "INSERT INTO transaksi (jenis, jumlah, keterangan, tanggal) VALUES (?, ?, ?, ?)";
    db.query(query, [jenis, jumlah, keterangan, tanggal], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Transaksi berhasil ditambahkan!" });
    });
});

// 3. READ: Ambil Data Transaksi (Dengan Filter)
app.get('/api/transaksi', (req, res) => {
    const { filter } = req.query;
    let query = "SELECT * FROM transaksi";
    
    if (filter === 'harian') {
        query += " WHERE tanggal = CURDATE()";
    } else if (filter === 'mingguan') {
        query += " WHERE YEARWEEK(tanggal, 1) = YEARWEEK(CURDATE(), 1)";
    } else if (filter === 'bulanan') {
        query += " WHERE MONTH(tanggal) = MONTH(CURDATE()) AND YEAR(tanggal) = YEAR(CURDATE())";
    }
    
    query += " ORDER BY tanggal DESC";

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 4. UPDATE: Edit Transaksi
app.put('/api/transaksi/:id', (req, res) => {
    const { id } = req.params;
    const { jenis, jumlah, keterangan, tanggal } = req.body;
    
    const query = "UPDATE transaksi SET jenis=?, jumlah=?, keterangan=?, tanggal=? WHERE id=?";
    db.query(query, [jenis, jumlah, keterangan, tanggal, id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Transaksi berhasil diperbarui!" });
    });
});

// 5. DELETE: Hapus Transaksi
app.delete('/api/transaksi/:id', (req, res) => {
    const { id } = req.params;
    const query = "DELETE FROM transaksi WHERE id = ?";
    db.query(query, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Transaksi berhasil dihapus!" });
    });
});

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});