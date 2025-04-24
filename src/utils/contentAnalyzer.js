const natural = require('natural');
const cheerio = require('cheerio');
const htmlParser = require('./htmlParser');

// Tokenizer để tách từ
const tokenizer = new natural.WordTokenizer();

// TF-IDF để trích xuất từ khóa
const TfIdf = natural.TfIdf;

/**
 * Trích xuất từ khóa từ nội dung HTML
 * @param {string} html - Nội dung HTML
 * @param {number} numKeywords - Số lượng từ khóa muốn trích xuất
 * @returns {Array} - Mảng các từ khóa và điểm số
 */
function extractKeywords(html, numKeywords = 10) {
  // Chuyển HTML thành văn bản thuần túy
  const plainText = htmlParser.htmlToPlainText(html);
  
  // Tách văn bản thành các đoạn
  const paragraphs = plainText.split('\n\n').filter(p => p.trim().length > 0);
  
  // Khởi tạo TF-IDF
  const tfidf = new TfIdf();
  
  // Thêm các đoạn vào TF-IDF
  paragraphs.forEach(paragraph => {
    tfidf.addDocument(paragraph);
  });
  
  // Nếu không có đủ đoạn, thêm toàn bộ văn bản
  if (paragraphs.length < 3) {
    tfidf.addDocument(plainText);
  }
  
  // Lấy các từ khóa từ toàn bộ văn bản
  const keywords = [];
  tfidf.listTerms(0).forEach(item => {
    // Bỏ qua các từ quá ngắn hoặc là số
    if (item.term.length > 2 && isNaN(item.term)) {
      keywords.push({
        term: item.term,
        score: item.tfidf
      });
    }
  });
  
  // Sắp xếp và trả về số lượng từ khóa yêu cầu
  return keywords
    .sort((a, b) => b.score - a.score)
    .slice(0, numKeywords);
}

/**
 * Trích xuất chủ đề chính từ nội dung HTML
 * @param {string} html - Nội dung HTML
 * @returns {Array} - Mảng các chủ đề chính
 */
function extractMainTopics(html) {
  // Phân tích cấu trúc HTML
  const $ = cheerio.load(html);
  
  // Lấy tất cả các tiêu đề
  const headings = [];
  $('h1, h2, h3').each((i, elem) => {
    const level = parseInt(elem.name.substring(1));
    const text = $(elem).text().trim();
    
    if (text.length > 0) {
      headings.push({
        level,
        text
      });
    }
  });
  
  // Nếu không tìm thấy tiêu đề, sử dụng phương pháp khác
  if (headings.length === 0) {
    // Sử dụng từ khóa làm chủ đề
    const keywords = extractKeywords(html, 5);
    return keywords.map(k => k.term);
  }
  
  return headings;
}

/**
 * Tạo tóm tắt tự động cho nội dung dài
 * @param {string} html - Nội dung HTML
 * @param {number} maxLength - Độ dài tối đa của tóm tắt (số ký tự)
 * @returns {string} - Tóm tắt
 */
function generateSummary(html, maxLength = 500) {
  // Chuyển HTML thành văn bản thuần túy
  const plainText = htmlParser.htmlToPlainText(html);
  
  // Tách văn bản thành các câu
  const sentences = plainText.match(/[^.!?]+[.!?]+/g) || [];
  
  // Nếu không có câu nào, trả về văn bản gốc đã cắt ngắn
  if (sentences.length === 0) {
    return plainText.substring(0, maxLength) + (plainText.length > maxLength ? '...' : '');
  }
  
  // Tính điểm cho mỗi câu dựa trên vị trí và độ dài
  const scoredSentences = sentences.map((sentence, index) => {
    // Câu đầu tiên và cuối cùng thường quan trọng hơn
    const positionScore = (index === 0 || index === sentences.length - 1) ? 2 : 1;
    
    // Câu quá ngắn hoặc quá dài thường ít quan trọng hơn
    const lengthScore = (sentence.length > 10 && sentence.length < 200) ? 1 : 0.5;
    
    return {
      text: sentence.trim(),
      score: positionScore * lengthScore,
      index
    };
  });
  
  // Sắp xếp câu theo điểm số và lấy các câu quan trọng nhất
  const topSentences = scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  
  // Sắp xếp lại theo thứ tự xuất hiện trong văn bản gốc
  const orderedSentences = topSentences
    .sort((a, b) => a.index - b.index)
    .map(s => s.text);
  
  // Tạo tóm tắt
  let summary = orderedSentences.join(' ');
  
  // Cắt ngắn nếu quá dài
  if (summary.length > maxLength) {
    summary = summary.substring(0, maxLength) + '...';
  }
  
  return summary;
}

/**
 * Phân tích cấu trúc của trang
 * @param {string} html - Nội dung HTML
 * @returns {Object} - Thông tin cấu trúc trang
 */
function analyzePageStructure(html) {
  // Phân tích cấu trúc HTML
  const $ = cheerio.load(html);
  
  // Đếm số lượng các phần tử
  const headingCount = $('h1, h2, h3, h4, h5, h6').length;
  const paragraphCount = $('p').length;
  const listCount = $('ul, ol').length;
  const tableCount = $('table').length;
  const imageCount = $('img').length;
  const linkCount = $('a').length;
  
  // Ước tính thời gian đọc (trung bình 200 từ/phút)
  const plainText = htmlParser.htmlToPlainText(html);
  const wordCount = plainText.split(/\s+/).length;
  const readingTimeMinutes = Math.ceil(wordCount / 200);
  
  return {
    headingCount,
    paragraphCount,
    listCount,
    tableCount,
    imageCount,
    linkCount,
    wordCount,
    readingTimeMinutes,
    complexity: calculateComplexity(headingCount, paragraphCount, listCount, tableCount)
  };
}

/**
 * Tính toán độ phức tạp của trang
 * @private
 */
function calculateComplexity(headings, paragraphs, lists, tables) {
  // Thuật toán đơn giản để đánh giá độ phức tạp
  const score = (headings * 2) + paragraphs + (lists * 1.5) + (tables * 3);
  
  if (score < 10) return 'Đơn giản';
  if (score < 30) return 'Trung bình';
  if (score < 60) return 'Phức tạp';
  return 'Rất phức tạp';
}

module.exports = {
  extractKeywords,
  extractMainTopics,
  generateSummary,
  analyzePageStructure
};
