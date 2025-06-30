const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, requireRole } = require('../middleware/auth');

// Registrar pago (subir comprobante de pago)
router.post('/', verificarToken, async (req, res) => {
  console.log('req.files:', req.files);
  console.log('req.body:', req.body);
  const { id_solicitud } = req.body;
  if (!id_solicitud) {
    return res.status(400).json({ error: 'Falta id_solicitud' });
  }
  // Verificar que la solicitud esté aprobada
  const solicitud = await db.query('SELECT estado FROM Solicitud WHERE id_solicitud = $1', [id_solicitud]);
  if (!solicitud.rows.length) {
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  }
  if (solicitud.rows[0].estado !== 'aprobada') {
    return res.status(403).json({ error: 'Solo puedes subir comprobante de pago si tu solicitud fue aprobada' });
  }
  if (!req.files || !req.files.comprobante) {
    return res.status(400).json({ error: 'Falta comprobante de pago (archivo)' });
  }
  const comprobante = req.files.comprobante;
  // Validar tipo de archivo
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowedTypes.includes(comprobante.mimetype)) {
    return res.status(400).json({ error: 'Tipo de archivo no permitido. Solo JPG, PNG o PDF.' });
  }
  const fileName = `${Date.now()}-${id_solicitud}-${comprobante.name}`;
  try {
    // Subir archivo a Supabase Storage
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { data, error } = await supabase.storage.from('documentos').upload(fileName, comprobante.data, {
      contentType: comprobante.mimetype,
      upsert: false
    });
    if (error) {
      return res.status(500).json({ error: 'Error al subir comprobante a Supabase', details: error.message });
    }
    const comprobante_url = `${process.env.SUPABASE_URL}/storage/v1/object/public/documentos/${fileName}`;
    // Guardar pago en la base de datos
    const result = await db.query(
      'INSERT INTO Pago (id_solicitud, comprobante_url) VALUES ($1, $2) RETURNING *',
      [id_solicitud, comprobante_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar pago', details: err.message });
  }
});

// Aprobar o rechazar pago (coordinador)
router.put('/:id_pago/validar', verificarToken, requireRole(['coordinador']), async (req, res) => {
  const { id_pago } = req.params;
  const { validado, estado_pago } = req.body;
  if (typeof validado !== 'boolean' || !['pagado', 'no pagado'].includes(estado_pago)) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }
  try {
    const result = await db.query(
      'UPDATE Pago SET validado_por_coordinador = $1, estado_pago = $2 WHERE id_pago = $3 RETURNING *',
      [validado, estado_pago, id_pago]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al validar pago' });
  }
});

// Obtener pagos de una solicitud
router.get('/solicitud/:id_solicitud', async (req, res) => {
  const { id_solicitud } = req.params;
  try {
    const result = await db.query('SELECT * FROM Pago WHERE id_solicitud = $1', [id_solicitud]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pagos' });
  }
});

module.exports = router;
