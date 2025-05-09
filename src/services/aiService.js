const { OpenAI } = require('openai');
const config = require('../config/config');
const contentAnalyzer = require('../utils/contentAnalyzer');
const htmlParser = require('../utils/htmlParser');
const imageProcessor = require('../utils/imageProcessor');

// Khởi tạo OpenAI client
const openai = new OpenAI({
  apiKey: config.openaiApiKey
});

/**
 * Service để xử lý các tính năng AI
 */
class AiService {
  /**
   * Trả lời câu hỏi dựa trên nội dung Confluence
   * @param {string} question - Câu hỏi của người dùng
   * @param {string} pageContent - Nội dung HTML của trang Confluence
   * @returns {Promise<string>} - Câu trả lời
   */
  async answerQuestion(question, pageContent) {
    try {
      // Chuyển HTML thành văn bản thuần túy
      const plainText = htmlParser.htmlToPlainText(pageContent);
      
      // Chuẩn bị context cho AI
      const prompt = `
Dựa trên nội dung sau đây từ Confluence:

${plainText.substring(0, 4000)}

Hãy trả lời câu hỏi này một cách ngắn gọn và chính xác: ${question}

Nếu nội dung không chứa thông tin để trả lời câu hỏi, hãy nói rõ rằng bạn không tìm thấy thông tin liên quan.
`;

      // Gọi API OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "Bạn là một trợ lý AI chuyên phân tích và trả lời câu hỏi dựa trên nội dung Confluence. Hãy trả lời ngắn gọn, chính xác và hữu ích." },
          { role: "user", content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error in answerQuestion:', error);
      throw new Error('Không thể trả lời câu hỏi: ' + error.message);
    }
  }

  /**
   * Tạo tóm tắt nội dung sử dụng AI
   * @param {string} pageContent - Nội dung HTML của trang
   * @param {string} customPrompt - Prompt tùy chỉnh của người dùng (tùy chọn)
   * @param {boolean} includeImages - Có phân tích hình ảnh hay không
   * @returns {Promise<string>} - Tóm tắt
   */
  async generateAiSummary(pageContent, customPrompt = '', includeImages = true) {
    try {
      // Chuyển HTML thành văn bản thuần túy
      const plainText = htmlParser.htmlToPlainText(pageContent);
      
      // Trích xuất từ khóa và chủ đề để cung cấp context
      const keywords = contentAnalyzer.extractKeywords(pageContent, 5);
      const topics = contentAnalyzer.extractMainTopics(pageContent);
      
      // Xử lý hình ảnh nếu được yêu cầu
      let imageAnalysis = '';
      if (includeImages) {
        try {
          // Trích xuất URL hình ảnh từ nội dung HTML
          const imageUrls = imageProcessor.extractImageUrls(pageContent);
          
          if (imageUrls.length > 0) {
            console.log(`Tìm thấy ${imageUrls.length} hình ảnh trong trang Confluence`);
            
            // Tải và xử lý tối đa 5 hình ảnh
            const processedImages = await imageProcessor.processImages(imageUrls, 5);
            
            if (processedImages.length > 0) {
              console.log(`Đã xử lý thành công ${processedImages.length} hình ảnh`);
              
              // Phân tích hình ảnh với Vision API
              const imagePrompt = customPrompt || 'Mô tả chi tiết nội dung của các hình ảnh này và tích hợp vào phân tích tổng thể.';
              imageAnalysis = await this.analyzeImages(processedImages, imagePrompt);
              console.log('Đã phân tích hình ảnh thành công');
            }
          }
        } catch (imageError) {
          console.error('Lỗi khi xử lý hình ảnh:', imageError);
          imageAnalysis = 'Không thể phân tích hình ảnh do lỗi kỹ thuật.';
        }
      }
      
      // Chuẩn bị context cho AI
      let prompt;
      
      if (customPrompt && customPrompt.trim() !== '') {
        // Sử dụng prompt tùy chỉnh của người dùng
        prompt = `
Nội dung Confluence:

${plainText.substring(0, 4000)}

Từ khóa chính: ${keywords.map(k => k.term).join(', ')}
Chủ đề chính: ${Array.isArray(topics) ? topics.map(t => typeof t === 'object' ? t.text : t).join(', ') : 'Không có'}

${imageAnalysis ? `Phân tích hình ảnh:
${imageAnalysis}

` : ''}
${customPrompt}
`;
      } else {
        // Sử dụng prompt mặc định
        prompt = `
Tóm tắt nội dung sau đây từ Confluence:

${plainText.substring(0, 4000)}

Từ khóa chính: ${keywords.map(k => k.term).join(', ')}
Chủ đề chính: ${Array.isArray(topics) ? topics.map(t => typeof t === 'object' ? t.text : t).join(', ') : 'Không có'}

${imageAnalysis ? `Phân tích hình ảnh:
${imageAnalysis}

` : ''}
Tạo một tóm tắt đầy đủ, rõ ràng và chi tiết về nội dung, không giới hạn độ dài.
`;
      }

      // Gọi API OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "Bạn là một trợ lý AI chuyên tóm tắt nội dung Confluence. Hãy tạo tóm tắt đầy đủ, rõ ràng và chính xác theo yêu cầu của người dùng, không giới hạn độ dài." },
          { role: "user", content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.5
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error in generateAiSummary:', error);
      // Fallback to non-AI summary if there's an error
      return contentAnalyzer.generateSummary(pageContent);
    }
  }

  /**
   * Tạo nội dung mới dựa trên template và dữ liệu hiện có
   * @param {Object} templateData - Dữ liệu template và hướng dẫn
   * @returns {Promise<string>} - Nội dung HTML đã tạo
   */
  async generateContent(templateData) {
    try {
      const { title, description, contentType, keywords, structure } = templateData;
      
      // Chuẩn bị prompt cho AI
      const prompt = `
Tạo nội dung Confluence với thông tin sau:

Tiêu đề: ${title}
Mô tả: ${description}
Loại nội dung: ${contentType}
Từ khóa: ${keywords.join(', ')}
Cấu trúc: ${structure}

Hãy tạo nội dung đầy đủ ở định dạng HTML phù hợp với Confluence. Nội dung nên bao gồm các tiêu đề, đoạn văn, và danh sách nếu cần thiết.
Đảm bảo nội dung rõ ràng, chuyên nghiệp và dễ đọc.
`;

      // Gọi API OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "Bạn là một trợ lý AI chuyên tạo nội dung cho Confluence. Hãy tạo nội dung HTML phù hợp với Confluence, đầy đủ và chuyên nghiệp." },
          { role: "user", content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.7
      });

      // Lấy nội dung HTML từ response
      let htmlContent = response.choices[0].message.content.trim();
      
      // Đảm bảo nội dung là HTML hợp lệ
      if (!htmlContent.includes('<')) {
        htmlContent = htmlParser.createConfluenceHtml(htmlContent);
      }

      return htmlContent;
    } catch (error) {
      console.error('Error in generateContent:', error);
      throw new Error('Không thể tạo nội dung: ' + error.message);
    }
  }

  /**
   * Phân tích và đưa ra đề xuất cải thiện nội dung
   * @param {string} pageContent - Nội dung HTML của trang
   * @returns {Promise<Array>} - Danh sách đề xuất
   */
  async analyzeContentQuality(pageContent) {
    try {
      // Chuyển HTML thành văn bản thuần túy
      const plainText = htmlParser.htmlToPlainText(pageContent);
      
      // Phân tích cấu trúc trang
      const structure = contentAnalyzer.analyzePageStructure(pageContent);
      
      // Chuẩn bị context cho AI
      const prompt = `
Phân tích chất lượng nội dung Confluence sau đây:

${plainText.substring(0, 3000)}

Thông tin cấu trúc trang:
- Số tiêu đề: ${structure.headingCount}
- Số đoạn văn: ${structure.paragraphCount}
- Số danh sách: ${structure.listCount}
- Số bảng: ${structure.tableCount}
- Số hình ảnh: ${structure.imageCount}
- Số liên kết: ${structure.linkCount}
- Số từ: ${structure.wordCount}
- Thời gian đọc: ${structure.readingTimeMinutes} phút
- Độ phức tạp: ${structure.complexity}

Hãy đưa ra 3-5 đề xuất cụ thể để cải thiện chất lượng nội dung này. Mỗi đề xuất nên ngắn gọn, rõ ràng và hữu ích.
`;

      // Gọi API OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "Bạn là một chuyên gia phân tích nội dung Confluence. Hãy đưa ra đề xuất cụ thể, thiết thực và hữu ích để cải thiện chất lượng nội dung." },
          { role: "user", content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      // Xử lý response để trả về danh sách đề xuất
      const suggestions = response.choices[0].message.content
        .split('\n')
        .filter(line => line.trim().length > 0 && (line.includes('-') || /^\d+\./.test(line)))
        .map(line => line.replace(/^-|\d+\.\s*/, '').trim());

      return suggestions;
    } catch (error) {
      console.error('Error in analyzeContentQuality:', error);
      return [
        'Không thể phân tích chất lượng nội dung do lỗi AI.',
        'Hãy đảm bảo nội dung có cấu trúc rõ ràng với các tiêu đề và đoạn văn.',
        'Thêm hình ảnh và bảng để minh họa thông tin khi cần thiết.'
      ];
    }
  }

  /**
   * Phân tích hình ảnh sử dụng OpenAI Vision API
   * @param {Array} images - Mảng các chuỗi base64 của hình ảnh
   * @param {string} prompt - Prompt cho việc phân tích hình ảnh
   * @returns {Promise<string>} - Kết quả phân tích hình ảnh
   */
  async analyzeImages(images, prompt) {
    if (!images || images.length === 0) {
      return '';
    }
    
    try {
      const messages = [
        { 
          role: "system", 
          content: "Bạn là trợ lý AI chuyên phân tích hình ảnh từ tài liệu Confluence. Hãy mô tả chi tiết nội dung hình ảnh và cung cấp phân tích có giá trị."
        },
        { 
          role: "user", 
          content: [
            { type: "text", text: prompt },
            ...images.map(img => ({ 
              type: "image_url", 
              image_url: { url: img } 
            }))
          ]
        }
      ];
      
      const response = await openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages,
        max_tokens: 1000
      });
      
      return response.choices[0].message.content;
    } catch (error) {
      console.error('Lỗi khi phân tích hình ảnh:', error);
      return "Không thể phân tích hình ảnh: " + error.message;
    }
  }

  /**
   * Xử lý nhiều URL Confluence và trả kết quả dựa trên prompt
   * @param {Array<Object>} pagesData - Mảng chứa dữ liệu của các trang Confluence
   * @param {string} customPrompt - Prompt tùy chỉnh của người dùng
   * @param {boolean} includeImages - Có phân tích hình ảnh hay không
   * @returns {Promise<string>} - Kết quả phân tích
   */
  async processMultiplePages(pagesData, customPrompt, includeImages = true) {
    try {
      // Chuẩn bị dữ liệu từ các trang
      const pagesInfo = pagesData.map(page => {
        // Trích xuất văn bản thuần túy và từ khóa
        const plainText = htmlParser.htmlToPlainText(page.content);
        const keywords = contentAnalyzer.extractKeywords(page.content, 5);
        
        return {
          title: page.pageTitle,
          url: page.url,
          content: plainText.substring(0, 2000), // Lấy 2000 ký tự đầu tiên của mỗi trang
          keywords: keywords.map(k => k.term).join(', '),
          htmlContent: page.content // Lưu nội dung HTML để xử lý hình ảnh
        };
      });
      
      // Xử lý hình ảnh nếu được yêu cầu
      let imageAnalysis = '';
      if (includeImages) {
        try {
          // Tập hợp URL hình ảnh từ tất cả các trang
          let allImageUrls = [];
          for (const page of pagesInfo) {
            const pageImageUrls = imageProcessor.extractImageUrls(page.htmlContent);
            if (pageImageUrls.length > 0) {
              console.log(`Tìm thấy ${pageImageUrls.length} hình ảnh trong trang ${page.title}`);
              allImageUrls = [...allImageUrls, ...pageImageUrls];
            }
          }
          
          // Giới hạn tổng số hình ảnh để tránh quá tải
          if (allImageUrls.length > 0) {
            // Tải và xử lý tối đa 10 hình ảnh từ tất cả các trang
            const processedImages = await imageProcessor.processImages(allImageUrls, 10);
            
            if (processedImages.length > 0) {
              console.log(`Đã xử lý thành công ${processedImages.length} hình ảnh từ tất cả các trang`);
              
              // Phân tích hình ảnh với Vision API
              const imagePrompt = customPrompt || 'Mô tả chi tiết nội dung của các hình ảnh này từ tài liệu Confluence và tích hợp vào phân tích tổng thể.';
              imageAnalysis = await this.analyzeImages(processedImages, imagePrompt);
              console.log('Đã phân tích hình ảnh từ tất cả các trang thành công');
            }
          }
        } catch (imageError) {
          console.error('Lỗi khi xử lý hình ảnh từ nhiều trang:', imageError);
          imageAnalysis = 'Không thể phân tích hình ảnh từ các trang do lỗi kỹ thuật.';
        }
      }
      
      // Tạo prompt cho AI
      const prompt = `
Tôi có ${pagesData.length} trang Confluence cần phân tích:

${pagesInfo.map((page, index) => `--- TRANG ${index + 1}: ${page.title} ---
URL: ${page.url}
Từ khóa: ${page.keywords}

Nội dung:
${page.content}
`).join('\n')}

${imageAnalysis ? `Phân tích hình ảnh từ các trang:
${imageAnalysis}

` : ''}
Dựa trên nội dung của tất cả các trang trên, hãy: ${customPrompt || 'Tổng hợp và phân tích thông tin chính'}
`;
      
      // Gọi API OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-16k", // Sử dụng mô hình có context dài hơn
        messages: [
          { 
            role: "system", 
            content: "Bạn là một trợ lý AI chuyên phân tích nhiều trang Confluence cùng lúc. Hãy phân tích và tổng hợp thông tin từ nhiều nguồn, đưa ra kết luận và đề xuất hữu ích dựa trên tất cả dữ liệu được cung cấp." 
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 2500,
        temperature: 0.5
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error in processMultiplePages:', error);
      throw new Error('Không thể xử lý nhiều trang: ' + error.message);
    }
  }
}

module.exports = new AiService();
