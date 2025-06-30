const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, requireRole } = require('../middleware/auth');

// Crear solicitud
router.post('/', async (req, res) => {
  const {
    id_usuario,
    numero_boleta,
    nombre_completo,
    semestre_actual,
    correo_personal,
    numero_celular
  } = req.body;
  if (!id_usuario || !numero_boleta || !nombre_completo || !semestre_actual || !correo_personal || !numero_celular) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  try {
    // Validar que el usuario no tenga ya una solicitud
    const existe = await db.query('SELECT * FROM Solicitud WHERE id_usuario = $1', [id_usuario]);
    if (existe.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe una solicitud para este usuario' });
    }
    const result = await db.query(
      `INSERT INTO Solicitud (id_usuario, numero_boleta, nombre_completo, semestre_actual, correo_personal, numero_celular)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_solicitud, id_usuario, numero_boleta, nombre_completo, semestre_actual, correo_personal, numero_celular, estado` ,
      [id_usuario, numero_boleta, nombre_completo, semestre_actual, correo_personal, numero_celular]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'La boleta ya está registrada' });
    } else {
      res.status(500).json({ error: 'Error al crear solicitud' });
    }
  }
});

// Obtener todas las solicitudes (para coordinador)
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM Solicitud');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

// Obtener solicitudes de un usuario (para alumno)
router.get('/usuario/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params;
  try {
    const result = await db.query('SELECT * FROM Solicitud WHERE id_usuario = $1', [id_usuario]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener solicitudes del usuario' });
  }
});

// Cambiar estado de solicitud (aprobada/rechazada) - solo coordinador
router.put('/:id_solicitud/estado', verificarToken, requireRole(['coordinador']), async (req, res) => {
  const { id_solicitud } = req.params;
  const { estado, motivo_rechazo } = req.body;
  if (!['pendiente', 'aprobada', 'rechazada'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }
  try {
    const result = await db.query(
      'UPDATE Solicitud SET estado = $1, motivo_rechazo = $2 WHERE id_solicitud = $3 RETURNING *',
      [estado, motivo_rechazo || null, id_solicitud]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estado de solicitud' });
  }
});

// Eliminar solicitud (solo coordinador)
router.delete('/:id_solicitud', verificarToken, requireRole(['coordinador']), async (req, res) => {
  const { id_solicitud } = req.params;
  try {
    const result = await db.query('DELETE FROM Solicitud WHERE id_solicitud = $1 RETURNING *', [id_solicitud]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar solicitud' });
  }
});

module.exports = router;
