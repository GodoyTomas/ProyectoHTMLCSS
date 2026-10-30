const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('./db');

const app = express();
const PORT = 3000;

// Crear carpeta uploads automáticamente si no existe
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

// Configuración de Multer para archivos de estudiantes
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${file.fieldname}-${Date.now()}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'foto_perfil') {
        return (ext === '.jpg' || ext === '.jpeg' || ext === '.png')
            ? cb(null, true)
            : cb(new Error('La foto de perfil debe ser JPG o PNG.'));
    }
    if (file.fieldname === 'cv_pdf') {
        return (ext === '.pdf')
            ? cb(null, true)
            : cb(new Error('El CV debe ser formato PDF.'));
    }
    if (file.fieldname === 'certificado_regular') {
        return cb(null, true);
    }
    cb(new Error('Campo de archivo no reconocido.'));
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }
});

const cpUpload = upload.fields([
    { name: 'foto_perfil', maxCount: 1 },
    { name: 'cv_pdf', maxCount: 1 },
    { name: 'certificado_regular', maxCount: 1 }
]);

// ==========================================
// MÓDULO 1: ESTUDIANTES
// ==========================================

app.post('/api/estudiantes', (req, res) => {
    cpUpload(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });

        try {
            if (!req.files['foto_perfil'] || !req.files['cv_pdf'] || !req.files['certificado_regular']) {
                return res.status(400).json({ error: 'Debés adjuntar los 3 archivos obligatorios.' });
            }

            const {
                nombre_completo, institucion, carrera, direccion,
                email, telefono, linkedin_url, github_portfolio_url,
                instagram_url, descripcion
            } = req.body;

            const fotoUrl = `/uploads/${req.files['foto_perfil'][0].filename}`;
            const cvUrl = `/uploads/${req.files['cv_pdf'][0].filename}`;
            const certificadoUrl = `/uploads/${req.files['certificado_regular'][0].filename}`;

            const query = `
                INSERT INTO estudiantes 
                (nombre_completo, institucion, carrera, direccion, email, telefono, 
                 linkedin_url, github_portfolio_url, instagram_url, descripcion, 
                 foto_perfil_url, cv_pdf_url, certificado_regular_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const [result] = await pool.query(query, [
                nombre_completo, institucion, carrera, direccion, email, telefono,
                linkedin_url || null, github_portfolio_url || null, instagram_url || null,
                descripcion, fotoUrl, cvUrl, certificadoUrl
            ]);

            res.status(201).json({ mensaje: 'Perfil registrado', id_estudiante: result.insertId });
        } catch (dbError) {
            console.error('Error al guardar estudiante:', dbError);
            if (dbError.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Ya existe un estudiante con ese email.' });
            }
            res.status(500).json({ error: dbError.sqlMessage || 'Error en MySQL' });
        }
    });
});

app.get('/api/estudiantes', async (req, res) => {
    try {
        const { carrera, institucion, q } = req.query;
        let query = 'SELECT * FROM estudiantes WHERE 1=1';
        const params = [];

        if (carrera) { query += ' AND carrera LIKE ?'; params.push(`%${carrera}%`); }
        if (institucion) { query += ' AND institucion LIKE ?'; params.push(`%${institucion}%`); }
        if (q) { query += ' AND (nombre_completo LIKE ? OR descripcion LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }

        query += ' ORDER BY fecha_registro DESC';
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener estudiantes:', error);
        res.status(500).json({ error: 'Error al obtener estudiantes' });
    }
});

app.put('/api/estudiantes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nombre_completo, institucion, carrera, direccion,
            email, telefono, linkedin_url, github_portfolio_url,
            instagram_url, descripcion
        } = req.body;

        await pool.query(
            `UPDATE estudiantes 
             SET nombre_completo=?, institucion=?, carrera=?, direccion=?, email=?, 
                 telefono=?, linkedin_url=?, github_portfolio_url=?, instagram_url=?, descripcion=?
             WHERE id_estudiante=?`,
            [
                nombre_completo, institucion, carrera, direccion, email,
                telefono, linkedin_url || null, github_portfolio_url || null,
                instagram_url || null, descripcion, id
            ]
        );
        res.json({ mensaje: 'Perfil actualizado' });
    } catch (error) {
        console.error('Error al actualizar estudiante:', error);
        res.status(500).json({ error: 'No se pudo actualizar el perfil' });
    }
});

app.delete('/api/estudiantes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            'SELECT foto_perfil_url, cv_pdf_url, certificado_regular_url FROM estudiantes WHERE id_estudiante = ?',
            [id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'No encontrado' });

        await pool.query('DELETE FROM estudiantes WHERE id_estudiante = ?', [id]);

        [rows[0].foto_perfil_url, rows[0].cv_pdf_url, rows[0].certificado_regular_url].forEach(r => {
            if (r) {
                const fullPath = path.join(__dirname, r);
                if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
            }
        });
        res.json({ mensaje: 'Eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar estudiante:', error);
        res.status(500).json({ error: 'No se pudo eliminar' });
    }
});

// ==========================================
// MÓDULO 2: EMPRESAS Y OFERTAS LABORALES
// ==========================================

app.get('/api/empresas', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM empresas ORDER BY razon_social ASC');
        res.json(rows);
    } catch (error) {
        console.error('Error GET /api/empresas:', error);
        res.status(500).json({ error: error.sqlMessage || 'Error al obtener empresas' });
    }
});

app.post('/api/empresas', async (req, res) => {
    try {
        const { razon_social, cuit, email_contacto, telefono, rubro, ubicacion } = req.body;
        const [result] = await pool.query(
            `INSERT INTO empresas (razon_social, cuit, email_contacto, telefono, rubro, ubicacion)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [razon_social, cuit, email_contacto, telefono || null, rubro || null, ubicacion || null]
        );
        res.status(201).json({ mensaje: 'Empresa registrada con éxito', id_empresa: result.insertId });
    } catch (error) {
        console.error('Error POST /api/empresas:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Ya existe una empresa con ese CUIT o Email.' });
        }
        res.status(500).json({ error: error.sqlMessage || 'No se pudo registrar la empresa' });
    }
});

app.get('/api/ofertas', async (req, res) => {
    try {
        const { carrera, modalidad, tipo_puesto } = req.query;
        let query = `
            SELECT o.*, e.razon_social, e.rubro, e.ubicacion, e.email_contacto
            FROM ofertas o
            INNER JOIN empresas e ON o.id_empresa = e.id_empresa
            WHERE o.activa = TRUE
        `;
        const params = [];

        if (carrera) { query += ' AND o.carrera_objetivo LIKE ?'; params.push(`%${carrera}%`); }
        if (modalidad) { query += ' AND o.modalidad = ?'; params.push(modalidad); }
        if (tipo_puesto) { query += ' AND o.tipo_puesto = ?'; params.push(tipo_puesto); }

        query += ' ORDER BY o.fecha_publicacion DESC';
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error GET /api/ofertas:', error);
        res.status(500).json({ error: error.sqlMessage || 'Error al obtener ofertas' });
    }
});

app.post('/api/ofertas', async (req, res) => {
    try {
        const { id_empresa, titulo, descripcion, carrera_objetivo, modalidad, tipo_puesto } = req.body;
        const [result] = await pool.query(
            `INSERT INTO ofertas (id_empresa, titulo, descripcion, carrera_objetivo, modalidad, tipo_puesto)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id_empresa, titulo, descripcion, carrera_objetivo, modalidad, tipo_puesto]
        );
        res.status(201).json({ mensaje: 'Oferta publicada con éxito', id_oferta: result.insertId });
    } catch (error) {
        console.error('Error POST /api/ofertas:', error);
        res.status(500).json({ error: error.sqlMessage || 'No se pudo publicar la oferta' });
    }
});

app.delete('/api/ofertas/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM ofertas WHERE id_oferta = ?', [req.params.id]);
        res.json({ mensaje: 'Oferta eliminada' });
    } catch (error) {
        console.error('Error DELETE /api/ofertas:', error);
        res.status(500).json({ error: 'No se pudo eliminar la oferta' });
    }
});

// ==========================================
// MÓDULO 3: POSTULACIONES
// ==========================================

app.post('/api/postulaciones', async (req, res) => {
    try {
        const { id_oferta, id_estudiante } = req.body;
        const [result] = await pool.query(
            `INSERT INTO postulaciones (id_oferta, id_estudiante) VALUES (?, ?)`,
            [id_oferta, id_estudiante]
        );
        res.status(201).json({ mensaje: 'Postulación registrada', id_postulacion: result.insertId });
    } catch (error) {
        console.error('Error POST /api/postulaciones:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Este estudiante ya se postuló a esta oferta.' });
        }
        res.status(500).json({ error: error.sqlMessage || 'Error al postular' });
    }
});

app.get('/api/ofertas/:id/postulantes', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT p.id_postulacion, p.estado, p.fecha_postulacion,
                    e.id_estudiante, e.nombre_completo, e.carrera, e.institucion,
                    e.email, e.telefono, e.foto_perfil_url, e.cv_pdf_url, e.certificado_regular_url
             FROM postulaciones p
             INNER JOIN estudiantes e ON p.id_estudiante = e.id_estudiante
             WHERE p.id_oferta = ?
             ORDER BY p.fecha_postulacion DESC`,
            [req.params.id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error GET postulantes:', error);
        res.status(500).json({ error: 'Error al obtener postulantes' });
    }
});

app.put('/api/postulaciones/:id', async (req, res) => {
    try {
        await pool.query(
            `UPDATE postulaciones SET estado = ? WHERE id_postulacion = ?`,
            [req.body.estado, req.params.id]
        );
        res.json({ mensaje: 'Estado actualizado' });
    } catch (error) {
        console.error('Error PUT postulaciones:', error);
        res.status(500).json({ error: 'No se pudo actualizar el estado' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});