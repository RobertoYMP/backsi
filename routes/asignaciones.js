const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, requireRole } = require('../middleware/auth');

// Crear asignación de casillero (cuando pago validado y casillero disponible) - solo coordinador
router.post('/', verificarToken, requireRole(['coordinador']), async (req, res) => {
  const { id_pago, id_casillero } = req.body;
  if (!id_pago || !id_casillero) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  try {
    // Verifica que el pago esté validado y el casillero disponible
    const pago = await db.query('SELECT * FROM Pago WHERE id_pago = $1 AND validado_por_coordinador = TRUE AND estado_pago = \'pagado\'', [id_pago]);
    const casillero = await db.query('SELECT * FROM Casillero WHERE id_casillero = $1 AND disponible = TRUE', [id_casillero]);
    if (pago.rows.length === 0) {
      return res.status(400).json({ error: 'El pago no está validado o no existe' });
    }
    if (casillero.rows.length === 0) {
      return res.status(400).json({ error: 'El casillero no está disponible o no existe' });
    }
    // Crea la asignación
    const result = await db.query(
      'INSERT INTO AsignacionCasillero (id_pago, id_casillero) VALUES ($1, $2) RETURNING *',
      [id_pago, id_casillero]
    );
    // Marca el casillero como no disponible
    await db.query('UPDATE Casillero SET disponible = FALSE WHERE id_casillero = $1', [id_casillero]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al asignar casillero' });
  }
});

// Obtener asignaciones (por usuario)
router.get('/usuario/:id_usuario', async (req, res) => {
  const { id_usuario } = req.params;
  try {
    const result = await db.query(
      `SELECT a.*, c.numero, c.ubicacion FROM AsignacionCasillero a
       JOIN Pago p ON a.id_pago = p.id_pago
       JOIN Solicitud s ON p.id_solicitud = s.id_solicitud
       JOIN Casillero c ON a.id_casillero = c.id_casillero
       WHERE s.id_usuario = $1`,
      [id_usuario]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener asignaciones' });
  }
});

// Obtener todas las asignaciones (coordinador)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.*, c.numero, c.ubicacion, p.id_solicitud FROM AsignacionCasillero a
       JOIN Pago p ON a.id_pago = p.id_pago
       JOIN Casillero c ON a.id_casillero = c.id_casillero`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener asignaciones' });
  }
});

module.exports = router;
