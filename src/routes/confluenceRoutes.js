const express = require('express');
const router = express.Router();
const confluenceService = require('../services/confluenceService');
const urlParser = require('../utils/urlParser');

/**
 * @route   POST /api/confluence/extract-page-id
 * @desc    Trích xuất ID trang từ URL Confluence
 * @access  Public
 */
router.post('/extract-page-id', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL Confluence là bắt buộc' });
    }
    
    const pageId = urlParser.normalizePageInput(url);
    
    if (!pageId) {
      return res.status(400).json({ error: 'Không thể trích xuất ID trang từ URL. Vui lòng kiểm tra lại URL.' });
    }
    
    res.json({ pageId });
  } catch (error) {
    console.error('Extract page ID error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/confluence/search
 * @desc    Tìm kiếm trang Confluence
 * @access  Public
 */
router.get('/search', async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Từ khóa tìm kiếm là bắt buộc' });
    }
    
    const results = await confluenceService.searchContent(query, parseInt(limit));
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/confluence/page/:id
 * @desc    Lấy thông tin chi tiết của một trang
 * @access  Public
 */
router.get('/page/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pageDetails = await confluenceService.getPageDetails(id);
    res.json(pageDetails);
  } catch (error) {
    console.error('Get page error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/confluence/page/:id/children
 * @desc    Lấy danh sách các trang con
 * @access  Public
 */
router.get('/page/:id/children', async (req, res) => {
  try {
    const { id } = req.params;
    const children = await confluenceService.getPageHierarchy(id);
    res.json(children);
  } catch (error) {
    console.error('Get children error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/confluence/page
 * @desc    Tạo hoặc cập nhật trang
 * @access  Public
 */
router.post('/page', async (req, res) => {
  try {
    const pageData = req.body;
    
    // Kiểm tra dữ liệu đầu vào
    if (!pageData.title || !pageData.content) {
      return res.status(400).json({ error: 'Tiêu đề và nội dung là bắt buộc' });
    }
    
    if (!pageData.id && !pageData.spaceKey) {
      return res.status(400).json({ error: 'Cần cung cấp ID trang (để cập nhật) hoặc Space Key (để tạo mới)' });
    }
    
    const result = await confluenceService.createOrUpdatePage(pageData);
    res.json(result);
  } catch (error) {
    console.error('Create/update page error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/confluence/spaces
 * @desc    Lấy danh sách không gian làm việc
 * @access  Public
 */
router.get('/spaces', async (req, res) => {
  try {
    const spaces = await confluenceService.getWorkspaces();
    res.json(spaces);
  } catch (error) {
    console.error('Get spaces error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/confluence/space/:spaceKey/structure
 * @desc    Lấy cấu trúc của một không gian Confluence
 * @access  Public
 */
router.get('/space/:spaceKey/structure', async (req, res) => {
  try {
    const { spaceKey } = req.params;
    
    if (!spaceKey) {
      return res.status(400).json({ error: 'Space key là bắt buộc' });
    }
    
    const structure = await confluenceService.getSpaceStructure(spaceKey);
    res.json(structure);
  } catch (error) {
    console.error('Get space structure error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/confluence/space/:spaceKey/search
 * @desc    Tìm kiếm trang trong một không gian cụ thể
 * @access  Public
 */
router.get('/space/:spaceKey/search', async (req, res) => {
  try {
    const { spaceKey } = req.params;
    const { query, limit = 20 } = req.query;
    
    if (!spaceKey) {
      return res.status(400).json({ error: 'Space key là bắt buộc' });
    }
    
    if (!query) {
      return res.status(400).json({ error: 'Từ khóa tìm kiếm là bắt buộc' });
    }
    
    const results = await confluenceService.searchInSpace(spaceKey, query, parseInt(limit));
    res.json(results);
  } catch (error) {
    console.error('Search in space error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/confluence/page-info
 * @desc    Lấy thông tin không gian dựa trên URL hoặc ID trang
 * @access  Public
 */
router.post('/page-info', async (req, res) => {
  try {
    const { pageIdOrUrl } = req.body;
    
    if (!pageIdOrUrl) {
      return res.status(400).json({ error: 'ID trang hoặc URL là bắt buộc' });
    }
    
    const spaceInfo = await confluenceService.getSpaceInfoFromPage(pageIdOrUrl);
    res.json(spaceInfo);
  } catch (error) {
    console.error('Get page info error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/confluence/page-structure
 * @desc    Lấy cấu trúc trang và các trang con
 * @access  Public
 */
router.post('/page-structure', async (req, res) => {
  try {
    const { pageIdOrUrl } = req.body;
    
    if (!pageIdOrUrl) {
      return res.status(400).json({ error: 'ID trang hoặc URL là bắt buộc' });
    }
    
    // Lấy thông tin trang gốc
    const pageInfo = await confluenceService.getSpaceInfoFromPage(pageIdOrUrl);
    const pageId = pageInfo.pageId;
    
    // Lấy chi tiết trang
    const page = await confluenceService.getPageDetails(pageId);
    
    // Lấy danh sách các trang con trực tiếp
    const childPages = await confluenceService.getPageHierarchy(pageId);
    
    // Tạo cấu trúc trang gốc
    const rootPage = {
      id: page.id,
      title: page.title,
      type: 'page',
      url: page.url,
      children: []
    };
    
    // Tạo map các trang con
    const pageMap = {
      [rootPage.id]: rootPage
    };
    
    // Thêm các trang con vào trang gốc
    childPages.forEach(childPage => {
      const childInfo = {
        id: childPage.id,
        title: childPage.title,
        type: 'page',
        url: childPage.url,
        children: []
      };
      
      pageMap[childInfo.id] = childInfo;
      rootPage.children.push(childInfo);
    });
    
    // Tạo các thư mục đặc biệt dựa trên tiêu đề trang
    organizeWeeklyMeetingPages(rootPage);
    
    res.json({
      pageId: page.id,
      title: page.title,
      spaceKey: page.spaceKey,
      spaceName: page.spaceName,
      children: rootPage.children
    });
  } catch (error) {
    console.error('Get page structure error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Sắp xếp các trang Weekly Meeting theo năm và Sprint
 * @param {Object} rootPage - Trang gốc
 */
function organizeWeeklyMeetingPages(rootPage) {
  // Chỉ xử lý nếu trang gốc là Weekly Meeting
  if (!rootPage.title.includes('Weekly Meeting')) return;
  
  // Tìm các trang Sprint
  const yearFolders = {};
  const sprintPattern = /Sprint\s*(\d+)\s*-\s*(\d+)\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i;
  
  // Lọc các trang con của Weekly Meeting
  const sprintPages = [];
  const otherPages = [];
  
  rootPage.children.forEach(page => {
    const match = page.title.match(sprintPattern);
    if (match) {
      sprintPages.push(page);
    } else {
      otherPages.push(page);
    }
  });
  
  // Xử lý các trang Sprint
  sprintPages.forEach(page => {
    const match = page.title.match(sprintPattern);
    if (match) {
      // Lấy năm từ tiêu đề hoặc từ thông tin trang
      let year = null;
      
      // Thử tìm năm trong tiêu đề
      const yearMatch = page.title.match(/(20\d\d)/); // Tìm năm dạng 20XX
      if (yearMatch) {
        year = yearMatch[1];
      } else {
        // Nếu không tìm thấy năm trong tiêu đề, dựa vào số Sprint để ước lượng năm
        const sprintNumber = parseInt(match[1]);
        
        if (sprintNumber >= 30) {
          year = '2025'; // Sprint mới hơn
        } else if (sprintNumber >= 20) {
          year = '2024'; // Sprint cũ hơn
        } else {
          year = '2023'; // Sprint rất cũ
        }
      }
      
      // Tạo thư mục năm nếu chưa có
      if (!yearFolders[year]) {
        yearFolders[year] = {
          id: `folder_${year}`,
          title: year,
          type: 'folder',
          children: [],
          isSpecialFolder: true
        };
      }
      
      // Thêm trang Sprint vào thư mục năm tương ứng
      yearFolders[year].children.push(page);
    }
  });
  
  // Sắp xếp các thư mục năm theo thứ tự giảm dần (năm mới nhất lên đầu)
  const sortedYearFolders = Object.values(yearFolders).sort((a, b) => b.title.localeCompare(a.title));
  
  // Sắp xếp các trang Sprint trong mỗi thư mục năm theo thứ tự giảm dần (Sprint mới nhất lên đầu)
  sortedYearFolders.forEach(yearFolder => {
    yearFolder.children.sort((a, b) => {
      const sprintA = a.title.match(/Sprint\s*(\d+)/i);
      const sprintB = b.title.match(/Sprint\s*(\d+)/i);
      
      if (sprintA && sprintB) {
        return parseInt(sprintB[1]) - parseInt(sprintA[1]);
      }
      
      return b.title.localeCompare(a.title);
    });
  });
  
  // Cập nhật danh sách trang con của trang gốc
  rootPage.children = sortedYearFolders.concat(otherPages);
}

module.exports = router;
