const express = require('express');
const router = express.Router();
const db = require('../db');
const { verificarToken, requireRole } = require('../middleware/auth');

// Obtener todos los casilleros
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM Casillero');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener casilleros' });
  }
});

// Obtener casilleros disponibles
router.get('/disponibles', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM Casillero WHERE disponible = TRUE');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener casilleros disponibles' });
  }
});

// Crear casillero (solo coordinador)
router.post('/', verificarToken, requireRole(['coordinador']), async (req, res) => {
  const { numero, ubicacion } = req.body;
  if (!numero || !ubicacion) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  try {
    const result = await db.query(
      'INSERT INTO Casillero (numero, ubicacion) VALUES ($1, $2) RETURNING *',
      [numero, ubicacion]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'El número de casillero ya existe' });
    } else {
      res.status(500).json({ error: 'Error al crear casillero' });
    }
  }
});

// Cambiar disponibilidad de casillero (solo coordinador)
router.put('/:id_casillero/disponibilidad', verificarToken, requireRole(['coordinador']), async (req, res) => {
  const { id_casillero } = req.params;
  const { disponible } = req.body;
  if (typeof disponible !== 'boolean') {
    return res.status(400).json({ error: 'Valor de disponibilidad inválido' });
  }
  try {
    const result = await db.query(
      'UPDATE Casillero SET disponible = $1 WHERE id_casillero = $2 RETURNING *',
      [disponible, id_casillero]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Casillero no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar disponibilidad' });
  }
});

// Eliminar casillero (solo coordinador, solo si no está asignado)
router.delete('/:id_casillero', verificarToken, requireRole(['coordinador']), async (req, res) => {
  const { id_casillero } = req.params;
  try {
    // Verifica que el casillero no esté asignado
    const asignado = await db.query('SELECT 1 FROM AsignacionCasillero WHERE id_casillero = $1', [id_casillero]);
    if (asignado.rows.length > 0) {
      return res.status(400).json({ error: 'No se puede eliminar un casillero asignado' });
    }
    const result = await db.query('DELETE FROM Casillero WHERE id_casillero = $1 RETURNING *', [id_casillero]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Casillero no encontrado' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar casillero' });
  }
});

module.exports = router;
