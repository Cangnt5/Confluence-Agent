const express = require('express');
const router = express.Router();
const confluenceService = require('../services/confluenceService');
const contentAnalyzer = require('../utils/contentAnalyzer');
const aiService = require('../services/aiService');
const batchAnalysisService = require('../services/batchAnalysisService');

/**
 * @route   POST /api/analysis/keywords
 * @desc    Trích xuất từ khóa từ nội dung trang
 * @access  Public
 */
router.post('/keywords', async (req, res) => {
  try {
    const { pageId, numKeywords = 10 } = req.body;
    
    if (!pageId) {
      return res.status(400).json({ error: 'ID trang là bắt buộc' });
    }
    
    // Lấy nội dung trang từ Confluence
    const page = await confluenceService.getPageDetails(pageId);
    
    // Trích xuất từ khóa
    const keywords = contentAnalyzer.extractKeywords(page.content, parseInt(numKeywords));
    
    res.json({
      pageId,
      pageTitle: page.title,
      keywords
    });
  } catch (error) {
    console.error('Extract keywords error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/analysis/topics
 * @desc    Trích xuất chủ đề chính từ nội dung trang
 * @access  Public
 */
router.post('/topics', async (req, res) => {
  try {
    const { pageId } = req.body;
    
    if (!pageId) {
      return res.status(400).json({ error: 'ID trang là bắt buộc' });
    }
    
    // Lấy nội dung trang từ Confluence
    const page = await confluenceService.getPageDetails(pageId);
    
    // Trích xuất chủ đề chính
    const topics = contentAnalyzer.extractMainTopics(page.content);
    
    res.json({
      pageId,
      pageTitle: page.title,
      topics
    });
  } catch (error) {
    console.error('Extract topics error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/analysis/summary
 * @desc    Tạo tóm tắt tự động cho trang
 * @access  Public
 */
router.post('/summary', async (req, res) => {
  try {
    const { pageId, maxLength = 500, useAi = false, customPrompt = '', includeImages = true } = req.body;
    
    if (!pageId) {
      return res.status(400).json({ error: 'ID trang là bắt buộc' });
    }
    
    // Lấy nội dung trang từ Confluence
    const page = await confluenceService.getPageDetails(pageId);
    
    // Tạo tóm tắt
    let summary;
    if (useAi) {
      summary = await aiService.generateAiSummary(page.content, customPrompt, includeImages);
    } else {
      summary = contentAnalyzer.generateSummary(page.content, parseInt(maxLength));
    }
    
    res.json({
      pageId,
      pageTitle: page.title,
      summary,
      method: useAi ? 'ai' : 'rule-based'
    });
  } catch (error) {
    console.error('Generate summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/analysis/structure
 * @desc    Phân tích cấu trúc trang
 * @access  Public
 */
router.post('/structure', async (req, res) => {
  try {
    const { pageId } = req.body;
    
    if (!pageId) {
      return res.status(400).json({ error: 'ID trang là bắt buộc' });
    }
    
    // Lấy nội dung trang từ Confluence
    const page = await confluenceService.getPageDetails(pageId);
    
    // Phân tích cấu trúc trang
    const structure = contentAnalyzer.analyzePageStructure(page.content);
    
    res.json({
      pageId,
      pageTitle: page.title,
      structure
    });
  } catch (error) {
    console.error('Analyze structure error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/analysis/batch
 * @desc    Phân tích nhiều URL Confluence cùng lúc
 * @access  Public
 */
// Route test đơn giản để kiểm tra server
router.get('/test', (req, res) => {
  res.json({ message: 'Route test hoạt động!' });
});

router.post('/batch', async (req, res) => {
  try {
    const { urls, useAi = false, customPrompt = '', maxLength = 500, includeImages = true } = req.body;
    
    if (!urls || (Array.isArray(urls) && urls.length === 0) || (typeof urls === 'string' && urls.trim() === '')) {
      return res.status(400).json({ error: 'Danh sách URL là bắt buộc' });
    }
    
    // Log để debug
    console.log('Đã nhận request phân tích hàng loạt:', { urls, useAi, customPrompt, includeImages });
    
    // Phân tích hàng loạt
    const results = await batchAnalysisService.analyzeBatch(urls, {
      useAi,
      customPrompt,
      maxLength,
      includeImages
    });
    
    res.json(results);
  } catch (error) {
    console.error('Batch analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
