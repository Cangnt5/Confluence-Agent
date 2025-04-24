const express = require('express');
const router = express.Router();
const confluenceService = require('../services/confluenceService');
const aiService = require('../services/aiService');

/**
 * @route   POST /api/ai/answer
 * @desc    Trả lời câu hỏi dựa trên nội dung trang
 * @access  Public
 */
router.post('/answer', async (req, res) => {
  try {
    const { pageId, question } = req.body;
    
    if (!pageId || !question) {
      return res.status(400).json({ error: 'ID trang và câu hỏi là bắt buộc' });
    }
    
    // Lấy nội dung trang từ Confluence
    const page = await confluenceService.getPageDetails(pageId);
    
    // Trả lời câu hỏi
    const answer = await aiService.answerQuestion(question, page.content);
    
    res.json({
      pageId,
      pageTitle: page.title,
      question,
      answer
    });
  } catch (error) {
    console.error('Answer question error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/ai/generate-content
 * @desc    Tạo nội dung mới dựa trên template
 * @access  Public
 */
router.post('/generate-content', async (req, res) => {
  try {
    const { title, description, contentType, keywords, structure } = req.body;
    
    if (!title || !description || !contentType) {
      return res.status(400).json({ error: 'Tiêu đề, mô tả và loại nội dung là bắt buộc' });
    }
    
    // Chuẩn bị dữ liệu template
    const templateData = {
      title,
      description,
      contentType,
      keywords: keywords || [],
      structure: structure || 'Tiêu đề, Giới thiệu, Nội dung chính, Kết luận'
    };
    
    // Tạo nội dung
    const content = await aiService.generateContent(templateData);
    
    res.json({
      title,
      content,
      templateData
    });
  } catch (error) {
    console.error('Generate content error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/ai/analyze-quality
 * @desc    Phân tích chất lượng nội dung và đưa ra đề xuất
 * @access  Public
 */
router.post('/analyze-quality', async (req, res) => {
  try {
    const { pageId } = req.body;
    
    if (!pageId) {
      return res.status(400).json({ error: 'ID trang là bắt buộc' });
    }
    
    // Lấy nội dung trang từ Confluence
    const page = await confluenceService.getPageDetails(pageId);
    
    // Phân tích chất lượng nội dung
    const suggestions = await aiService.analyzeContentQuality(page.content);
    
    res.json({
      pageId,
      pageTitle: page.title,
      suggestions
    });
  } catch (error) {
    console.error('Analyze quality error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
