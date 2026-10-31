const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('./db');

const app = express();
const PORT = 3000;

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

// Configuración de Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${file.fieldname}-${Date.now()}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'foto_perfil' || file.fieldname === 'logo_empresa') {
        return (ext === '.jpg' || ext === '.jpeg' || ext === '.png')
            ? cb(null, true)
            : cb(new Error('La imagen debe ser JPG o PNG.'));
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
// 1. AUTENTICACIÓN MULTI-ROL (LOGIN)
// ==========================================
app.post('/api/auth/login', async (req, res) => {
    try {
        const { rol, email, password } = req.body;

        if (rol === 'admin') {
            const [rows] = await pool.query(
                'SELECT id_admin AS id, nombre, email FROM administradores WHERE email = ? AND password = ?',
                [email, password]
            );
            if (rows.length === 0) return res.status(401).json({ error: 'Credenciales de administrador inválidas.' });
            return res.json({ rol: 'admin', usuario: rows[0] });
        }

        if (rol === 'estudiante') {
            const [rows] = await pool.query(
                'SELECT * FROM estudiantes WHERE email = ? AND password = ?',
                [email, password]
            );
            if (rows.length === 0) return res.status(401).json({ error: 'Email o contraseña de estudiante incorrectos.' });
            const est = rows[0];
            delete est.password;
            return res.json({ rol: 'estudiante', usuario: est });
        }

        if (rol === 'empresa') {
            const [rows] = await pool.query(
                'SELECT * FROM empresas WHERE email_contacto = ? AND password = ?',
                [email, password]
            );
            if (rows.length === 0) return res.status(401).json({ error: 'Email o contraseña de empresa incorrectos.' });
            const emp = rows[0];
            delete emp.password;
            return res.json({ rol: 'empresa', usuario: emp });
        }

        res.status(400).json({ error: 'Rol no válido.' });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno en el servidor.' });
    }
});

// ==========================================
// 2. GESTIÓN DE ESTUDIANTES
// ==========================================

// Registro de Estudiante (Con 3 archivos obligatorios)
app.post('/api/estudiantes', (req, res) => {
    cpUpload(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });

        try {
            if (!req.files['foto_perfil'] || !req.files['cv_pdf'] || !req.files['certificado_regular']) {
                return res.status(400).json({ error: 'Debés adjuntar Foto, CV (PDF) y Certificado Regular.' });
            }

            const {
                nombre_completo, institucion, carrera, direccion,
                email, password, telefono, linkedin_url,
                github_portfolio_url, instagram_url, descripcion
            } = req.body;

            const fotoUrl = `/uploads/${req.files['foto_perfil'][0].filename}`;
            const cvUrl = `/uploads/${req.files['cv_pdf'][0].filename}`;
            const certificadoUrl = `/uploads/${req.files['certificado_regular'][0].filename}`;

            const [result] = await pool.query(
                `INSERT INTO estudiantes 
                (nombre_completo, institucion, carrera, direccion, email, password, telefono, 
                 linkedin_url, github_portfolio_url, instagram_url, descripcion, 
                 foto_perfil_url, cv_pdf_url, certificado_regular_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    nombre_completo, institucion, carrera, direccion, email, password, telefono,
                    linkedin_url || null, github_portfolio_url || null, instagram_url || null,
                    descripcion, fotoUrl, cvUrl, certificadoUrl
                ]
            );

            res.status(201).json({ mensaje: 'Estudiante registrado con éxito', id_estudiante: result.insertId });
        } catch (dbError) {
            console.error('Error al registrar estudiante:', dbError);
            if (dbError.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Ya existe una cuenta con ese email.' });
            }
            res.status(500).json({ error: dbError.sqlMessage || 'Error en MySQL' });
        }
    });
});

// Listar / Buscar Estudiantes
app.get('/api/estudiantes', async (req, res) => {
    try {
        const { carrera, institucion, q } = req.query;
        let query = `
            SELECT id_estudiante, nombre_completo, institucion, carrera, direccion, email, telefono,
                   linkedin_url, github_portfolio_url, instagram_url, descripcion,
                   foto_perfil_url, cv_pdf_url, certificado_regular_url, fecha_registro
            FROM estudiantes WHERE 1=1
        `;
        const params = [];

        if (carrera) { query += ' AND carrera LIKE ?'; params.push(`%${carrera}%`); }
        if (institucion) { query += ' AND institucion LIKE ?'; params.push(`%${institucion}%`); }
        if (q) { query += ' AND (nombre_completo LIKE ? OR descripcion LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }

        query += ' ORDER BY fecha_registro DESC';
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener estudiantes' });
    }
});

// Obtener un estudiante por ID
app.get('/api/estudiantes/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM estudiantes WHERE id_estudiante = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        delete rows[0].password;
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener perfil' });
    }
});

// Actualizar Perfil de Estudiante (Datos y archivos opcionales)
app.put('/api/estudiantes/:id', (req, res) => {
    cpUpload(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });

        try {
            const { id } = req.params;
            const [actual] = await pool.query('SELECT * FROM estudiantes WHERE id_estudiante = ?', [id]);
            if (actual.length === 0) return res.status(404).json({ error: 'Estudiante no encontrado' });

            const est = actual[0];
            const {
                nombre_completo, institucion, carrera, direccion,
                email, password, telefono, linkedin_url,
                github_portfolio_url, instagram_url, descripcion
            } = req.body;

            const fotoUrl = (req.files && req.files['foto_perfil'])
                ? `/uploads/${req.files['foto_perfil'][0].filename}`
                : est.foto_perfil_url;
            const cvUrl = (req.files && req.files['cv_pdf'])
                ? `/uploads/${req.files['cv_pdf'][0].filename}`
                : est.cv_pdf_url;
            const certUrl = (req.files && req.files['certificado_regular'])
                ? `/uploads/${req.files['certificado_regular'][0].filename}`
                : est.certificado_regular_url;

            const nuevaPass = (password && password.trim() !== '') ? password : est.password;

            await pool.query(
                `UPDATE estudiantes 
                 SET nombre_completo=?, institucion=?, carrera=?, direccion=?, email=?, password=?,
                     telefono=?, linkedin_url=?, github_portfolio_url=?, instagram_url=?, descripcion=?,
                     foto_perfil_url=?, cv_pdf_url=?, certificado_regular_url=?
                 WHERE id_estudiante=?`,
                [
                    nombre_completo, institucion, carrera, direccion, email, nuevaPass,
                    telefono, linkedin_url || null, github_portfolio_url || null,
                    instagram_url || null, descripcion, fotoUrl, cvUrl, certUrl, id
                ]
            );

            const [actualizado] = await pool.query('SELECT * FROM estudiantes WHERE id_estudiante = ?', [id]);
            delete actualizado[0].password;
            res.json({ mensaje: 'Perfil actualizado', usuario: actualizado[0] });
        } catch (error) {
            console.error('Error al actualizar estudiante:', error);
            res.status(500).json({ error: 'No se pudo actualizar el perfil' });
        }
    });
});

// Eliminar Estudiante
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
        res.json({ mensaje: 'Estudiante eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo eliminar el estudiante' });
    }
});

// ==========================================
// 3. GESTIÓN DE EMPRESAS
// ==========================================

// ==========================================
// 3. GESTIÓN DE EMPRESAS (CON IMAGEN / LOGO)
// ==========================================

const uploadLogoEmpresa = upload.single('logo_empresa');

app.post('/api/empresas', (req, res) => {
    uploadLogoEmpresa(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });

        try {
            const { razon_social, cuit, email_contacto, password, telefono, rubro, ubicacion, descripcion_empresa } = req.body;
            const logoUrl = req.file ? `/uploads/${req.file.filename}` : null;

            const [result] = await pool.query(
                `INSERT INTO empresas (razon_social, cuit, email_contacto, password, telefono, rubro, ubicacion, descripcion_empresa, logo_url)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [razon_social, cuit, email_contacto, password, telefono || null, rubro || null, ubicacion || null, descripcion_empresa || null, logoUrl]
            );
            res.status(201).json({ mensaje: 'Empresa registrada con éxito', id_empresa: result.insertId });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Ya existe una empresa con ese CUIT o Email.' });
            }
            res.status(500).json({ error: error.sqlMessage || 'Error al registrar empresa' });
        }
    });
});

app.get('/api/empresas', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id_empresa, razon_social, cuit, email_contacto, telefono, rubro, ubicacion, descripcion_empresa, logo_url, fecha_registro FROM empresas ORDER BY razon_social ASC'
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener empresas' });
    }
});

app.put('/api/empresas/:id', (req, res) => {
    uploadLogoEmpresa(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });

        try {
            const { id } = req.params;
            const { razon_social, cuit, email_contacto, password, telefono, rubro, ubicacion, descripcion_empresa } = req.body;

            const [actual] = await pool.query('SELECT * FROM empresas WHERE id_empresa = ?', [id]);
            if (actual.length === 0) return res.status(404).json({ error: 'Empresa no encontrada' });

            const nuevaPass = (password && password.trim() !== '') ? password : actual[0].password;
            const nuevoLogo = req.file ? `/uploads/${req.file.filename}` : actual[0].logo_url;

            await pool.query(
                `UPDATE empresas 
                 SET razon_social=?, cuit=?, email_contacto=?, password=?, telefono=?, rubro=?, ubicacion=?, descripcion_empresa=?, logo_url=?
                 WHERE id_empresa=?`,
                [razon_social, cuit, email_contacto, nuevaPass, telefono || null, rubro || null, ubicacion || null, descripcion_empresa || null, nuevoLogo, id]
            );

            const [actualizada] = await pool.query('SELECT * FROM empresas WHERE id_empresa = ?', [id]);
            delete actualizada[0].password;
            res.json({ mensaje: 'Empresa actualizada', usuario: actualizada[0] });
        } catch (error) {
            res.status(500).json({ error: 'No se pudo actualizar la empresa' });
        }
    });
});

app.delete('/api/empresas/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Buscar si la empresa tiene un logo guardado para borrar el archivo físico
        const [empRows] = await pool.query('SELECT logo_url FROM empresas WHERE id_empresa = ?', [id]);
        if (empRows.length === 0) {
            return res.status(404).json({ error: 'Empresa no encontrada.' });
        }

        // 2. Borrar en orden jerárquico para evitar bloqueos de Foreign Keys en MySQL
        await pool.query('DELETE FROM mensajes WHERE id_empresa = ?', [id]);
        await pool.query(
            'DELETE FROM postulaciones WHERE id_oferta IN (SELECT id_oferta FROM ofertas WHERE id_empresa = ?)',
            [id]
        );
        await pool.query('DELETE FROM ofertas WHERE id_empresa = ?', [id]);
        await pool.query('DELETE FROM empresas WHERE id_empresa = ?', [id]);

        // 3. Eliminar el archivo del logo de la carpeta uploads/ si existe
        if (empRows[0].logo_url) {
            const fullPath = path.join(__dirname, empRows[0].logo_url);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        }

        res.json({ mensaje: 'Empresa y todos sus registros asociados eliminados correctamente.' });
    } catch (error) {
        console.error('Error al eliminar empresa:', error);
        res.status(500).json({ error: error.sqlMessage || 'No se pudo eliminar la empresa.' });
    }
});

// ==========================================
// 4. OFERTAS Y POSTULACIONES (CON LECTURA)
// ==========================================

app.get('/api/ofertas', async (req, res) => {
    try {
        const { carrera, modalidad, tipo_puesto, id_empresa } = req.query;
        let query = `
            SELECT o.*, e.razon_social, e.rubro, e.ubicacion, e.email_contacto, e.logo_url
            FROM ofertas o
            INNER JOIN empresas e ON o.id_empresa = e.id_empresa
            WHERE o.activa = TRUE
        `;
        const params = [];

        if (carrera) { query += ' AND o.carrera_objetivo LIKE ?'; params.push(`%${carrera}%`); }
        if (modalidad) { query += ' AND o.modalidad = ?'; params.push(modalidad); }
        if (tipo_puesto) { query += ' AND o.tipo_puesto = ?'; params.push(tipo_puesto); }
        if (id_empresa) { query += ' AND o.id_empresa = ?'; params.push(id_empresa); }

        query += ' ORDER BY o.fecha_publicacion DESC';
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener ofertas' });
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
        res.status(201).json({ mensaje: 'Oferta publicada', id_oferta: result.insertId });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo publicar la oferta' });
    }
});

app.put('/api/ofertas/:id', async (req, res) => {
    try {
        const { titulo, descripcion, carrera_objetivo, modalidad, tipo_puesto } = req.body;
        await pool.query(
            `UPDATE ofertas SET titulo=?, descripcion=?, carrera_objetivo=?, modalidad=?, tipo_puesto=? WHERE id_oferta=?`,
            [titulo, descripcion, carrera_objetivo, modalidad, tipo_puesto, req.params.id]
        );
        res.json({ mensaje: 'Oferta actualizada' });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo actualizar la oferta' });
    }
});

app.delete('/api/ofertas/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM ofertas WHERE id_oferta = ?', [req.params.id]);
        res.json({ mensaje: 'Oferta eliminada' });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo eliminar la oferta' });
    }
});

// Postularse a una oferta
app.post('/api/postulaciones', async (req, res) => {
    try {
        const { id_oferta, id_estudiante } = req.body;
        const [result] = await pool.query(
            `INSERT INTO postulaciones (id_oferta, id_estudiante) VALUES (?, ?)`,
            [id_oferta, id_estudiante]
        );
        res.status(201).json({ mensaje: 'Postulación enviada', id_postulacion: result.insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Ya te postulaste a esta oferta anteriormente.' });
        }
        res.status(500).json({ error: 'Error al postularse' });
    }
});

// Ver postulantes de una oferta (Y marcar automáticamente como "Leído por la empresa")
app.get('/api/ofertas/:id/postulantes', async (req, res) => {
    try {
        const { id } = req.params;
        const { marcar_leido } = req.query;

        if (marcar_leido === 'true') {
            await pool.query(
                `UPDATE postulaciones 
                 SET leido_por_empresa = TRUE, fecha_lectura = COALESCE(fecha_lectura, CURRENT_TIMESTAMP)
                 WHERE id_oferta = ?`,
                [id]
            );
        }

        const [rows] = await pool.query(
            `SELECT p.id_postulacion, p.estado, p.leido_por_empresa, p.fecha_lectura, p.fecha_postulacion,
                    e.id_estudiante, e.nombre_completo, e.carrera, e.institucion,
                    e.email, e.telefono, e.foto_perfil_url, e.cv_pdf_url, e.certificado_regular_url
             FROM postulaciones p
             INNER JOIN estudiantes e ON p.id_estudiante = e.id_estudiante
             WHERE p.id_oferta = ?
             ORDER BY p.fecha_postulacion DESC`,
            [id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener postulantes' });
    }
});

// Actualizar estado de postulación (y marcar como leído)
app.put('/api/postulaciones/:id', async (req, res) => {
    try {
        const { estado } = req.body;
        await pool.query(
            `UPDATE postulaciones 
             SET estado = ?, leido_por_empresa = TRUE, fecha_lectura = COALESCE(fecha_lectura, CURRENT_TIMESTAMP)
             WHERE id_postulacion = ?`,
            [estado, req.params.id]
        );
        res.json({ mensaje: 'Estado actualizado' });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo actualizar el estado' });
    }
});

// Ver postulaciones de un estudiante (Con estado y si fue leída por la empresa)
app.get('/api/estudiantes/:id/postulaciones', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT p.id_postulacion, p.estado, p.leido_por_empresa, p.fecha_lectura, p.fecha_postulacion,
                    o.id_oferta, o.titulo, o.modalidad, o.tipo_puesto,
                    e.id_empresa, e.razon_social, e.ubicacion
             FROM postulaciones p
             INNER JOIN ofertas o ON p.id_oferta = o.id_oferta
             INNER JOIN empresas e ON o.id_empresa = e.id_empresa
             WHERE p.id_estudiante = ?
             ORDER BY p.fecha_postulacion DESC`,
            [req.params.id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al consultar postulaciones' });
    }
});

// ==========================================
// 5. MENSAJERÍA BIDIRECCIONAL (CHAT)
// ==========================================

// Obtener historial de mensajes entre un estudiante y una empresa
app.get('/api/mensajes', async (req, res) => {
    try {
        const { id_estudiante, id_empresa } = req.query;
        const [rows] = await pool.query(
            `SELECT m.*, est.nombre_completo AS nombre_estudiante, emp.razon_social AS nombre_empresa
             FROM mensajes m
             INNER JOIN estudiantes est ON m.id_estudiante = est.id_estudiante
             INNER JOIN empresas emp ON m.id_empresa = emp.id_empresa
             WHERE m.id_estudiante = ? AND m.id_empresa = ?
             ORDER BY m.fecha_envio ASC`,
            [id_estudiante, id_empresa]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al cargar mensajes' });
    }
});

// Obtener lista de conversaciones activas de un usuario
app.get('/api/conversaciones', async (req, res) => {
    try {
        const { rol, id } = req.query;
        if (rol === 'estudiante') {
            const [rows] = await pool.query(
                `SELECT DISTINCT emp.id_empresa, emp.razon_social, emp.rubro, emp.email_contacto
                 FROM mensajes m
                 INNER JOIN empresas emp ON m.id_empresa = emp.id_empresa
                 WHERE m.id_estudiante = ?`,
                [id]
            );
            return res.json(rows);
        }
        if (rol === 'empresa') {
            const [rows] = await pool.query(
                `SELECT DISTINCT est.id_estudiante, est.nombre_completo, est.carrera, est.foto_perfil_url
                 FROM mensajes m
                 INNER JOIN estudiantes est ON m.id_estudiante = est.id_estudiante
                 WHERE m.id_empresa = ?`,
                [id]
            );
            return res.json(rows);
        }
        res.json([]);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener conversaciones' });
    }
});

// Enviar un mensaje
app.post('/api/mensajes', async (req, res) => {
    try {
        const { id_estudiante, id_empresa, remitente, contenido } = req.body;
        const [result] = await pool.query(
            `INSERT INTO mensajes (id_estudiante, id_empresa, remitente, contenido) VALUES (?, ?, ?, ?)`,
            [id_estudiante, id_empresa, remitente, contenido]
        );
        res.status(201).json({ mensaje: 'Enviado', id_mensaje: result.insertId });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo enviar el mensaje' });
    }
});

// Estadísticas globales
app.get('/api/estadisticas', async (req, res) => {
    try {
        const [[{ total_estudiantes }]] = await pool.query('SELECT COUNT(*) AS total_estudiantes FROM estudiantes');
        const [[{ total_empresas }]] = await pool.query('SELECT COUNT(*) AS total_empresas FROM empresas');
        const [[{ total_ofertas }]] = await pool.query('SELECT COUNT(*) AS total_ofertas FROM ofertas WHERE activa = TRUE');
        const [[{ total_postulaciones }]] = await pool.query('SELECT COUNT(*) AS total_postulaciones FROM postulaciones');
        res.json({
            estudiantes: total_estudiantes,
            empresas: total_empresas,
            ofertas: total_ofertas,
            postulaciones: total_postulaciones
        });
    } catch (error) {
        res.status(500).json({ error: 'Error en estadísticas' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});