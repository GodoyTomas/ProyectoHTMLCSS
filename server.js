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
// Exponer la carpeta uploads para poder ver las fotos y descargar CVs desde el navegador
app.use('/uploads', express.static(uploadDir));

// Configuración de almacenamiento de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Nombre único: campo + fecha + extensión original (ej: cv_pdf-1730200000.pdf)
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${file.fieldname}-${Date.now()}${ext}`);
    }
});

// Filtro de seguridad por tipo de archivo según el campo
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (file.fieldname === 'foto_perfil') {
        if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
            return cb(null, true);
        }
        return cb(new Error('La foto de perfil debe ser formato JPG o PNG.'));
    }

    if (file.fieldname === 'cv_pdf') {
        if (ext === '.pdf') {
            return cb(null, true);
        }
        return cb(new Error('El CV debe estar en formato PDF.'));
    }

    if (file.fieldname === 'certificado_regular') {
        // Acepta cualquier formato (.pdf, .jpg, .png, .docx, etc.)
        return cb(null, true);
    }

    cb(new Error('Campo de archivo no reconocido.'));
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // Límite de 10MB por archivo
});

// Ruta POST para registrar al estudiante con sus 3 archivos
const cpUpload = upload.fields([
    { name: 'foto_perfil', maxCount: 1 },
    { name: 'cv_pdf', maxCount: 1 },
    { name: 'certificado_regular', maxCount: 1 }
]);

app.post('/api/estudiantes', (req, res) => {
    cpUpload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        try {
            // Verificar que se hayan subido los 3 archivos
            if (!req.files['foto_perfil'] || !req.files['cv_pdf'] || !req.files['certificado_regular']) {
                return res.status(400).json({ error: 'Debés adjuntar los 3 archivos obligatorios.' });
            }

            const {
                nombre_completo, institucion, carrera, direccion,
                email, telefono, linkedin_url, github_portfolio_url,
                instagram_url, descripcion
            } = req.body;

            // Rutas relativas para guardar en MySQL
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

            res.status(201).json({
                mensaje: 'Perfil de estudiante registrado exitosamente',
                id_estudiante: result.insertId
            });

        } catch (dbError) {
            console.error('Error en base de datos:', dbError);
            if (dbError.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Ya existe un estudiante registrado con ese email.' });
            }
            res.status(500).json({ error: 'Error al guardar los datos en MySQL.' });
        }
    });
});

// Ruta GET para ver todos los perfiles de estudiantes cargados
app.get('/api/estudiantes', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM estudiantes ORDER BY fecha_registro DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener estudiantes' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});