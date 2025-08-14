const express = require('express');
const router = express.Router();
const Faq = require('../models/Faq');

router.get('/', async (req, res) => {
  try {
    const faqs = await Faq.find().sort({ createdAt: -1 });
    res.json(faqs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/seed', async (req, res) => {
  try {
    const data = req.body?.faqs ?? [
      { question: 'What is Next.js Page Router?', answer: 'The legacy router using /pages directory.' },
      { question: 'How does the community work?', answer: 'Create threads and receive replies.' },
    ];
    const inserted = await Faq.insertMany(data);
    res.json({ inserted });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
