const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const supabase = require('../routes/supabaseClient');

// Multer en memoria con límite de tamaño (10 MB)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

// Subir documento PDF a Supabase Storage
router.post('/', upload.single('archivo'), async (req, res) => {
  console.log('---- NUEVA PETICIÓN ----');
  console.log('req.file:', req.file);
  console.log('req.body:', req.body);
  console.log('headers:', req.headers);
  if (!req.file) console.log('NO LLEGA ARCHIVO');
  if (!req.body.id_solicitud) console.log('NO LLEGA id_solicitud');
  if (!req.body.tipo) console.log('NO LLEGA tipo');
  const { id_solicitud, tipo } = req.body;
  if (!id_solicitud || !tipo || !req.file) {
    return res.status(400).json({ error: 'Faltan campos requeridos o archivo' });
  }
  try {
    // Nombre único para el archivo
    const ext = req.file.originalname.split('.').pop();
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${tipo.replace(/\s/g, '_')}.${ext}`;
    // Subir a Supabase Storage (bucket 'documentos')
    const { data, error } = await supabase.storage.from('documentos').upload(fileName, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: true
    });
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message || 'Error al subir a Supabase Storage' });
    }
    // Obtener URL pública
    const { data: publicUrl } = supabase.storage.from('documentos').getPublicUrl(fileName);
    // Guardar en la base de datos
    const result = await db.query(
      'INSERT INTO Documento (id_solicitud, tipo, ruta_archivo) VALUES ($1, $2, $3) RETURNING *',
      [id_solicitud, tipo, publicUrl.publicUrl]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al subir documento' });
  }
});

// Obtener documentos de una solicitud
router.get('/solicitud/:id_solicitud', async (req, res) => {
  const { id_solicitud } = req.params;
  try {
    const result = await db.query('SELECT * FROM Documento WHERE id_solicitud = $1', [id_solicitud]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener documentos' });
  }
});

// Obtener documentos de un usuario (JOIN Solicitud)
router.get('/usuario/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params;
  try {
    const result = await db.query(
      `SELECT d.* FROM Documento d
       JOIN Solicitud s ON d.id_solicitud = s.id_solicitud
       WHERE s.id_usuario = $1`,
      [id_usuario]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener documentos del usuario' });
  }
});

// Manejo de errores de multer (límite de tamaño, etc)
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo es demasiado grande. Máximo 10 MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
