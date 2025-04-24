const axios = require('axios');
const config = require('../config/config');

// Tạo instance axios với cấu hình cơ bản
const confluenceApi = axios.create({
  baseURL: config.confluenceBaseUrl,
  auth: {
    username: config.confluenceUsername,
    password: config.confluenceApiToken
  },
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Lấy thông tin về một trang Confluence theo ID
 * @param {string} pageId - ID của trang Confluence
 * @returns {Promise<Object>} - Thông tin trang
 */
async function getPageById(pageId) {
  try {
    const response = await confluenceApi.get(`/rest/api/content/${pageId}?expand=body.storage,version,space`);
    return response.data;
  } catch (error) {
    console.error('Error getting page by ID:', error.message);
    throw error;
  }
}

/**
 * Tìm kiếm các trang Confluence
 * @param {string} query - Chuỗi tìm kiếm
 * @param {number} limit - Số lượng kết quả tối đa
 * @returns {Promise<Array>} - Danh sách các trang phù hợp
 */
async function searchPages(query, limit = 10) {
  try {
    const response = await confluenceApi.get('/rest/api/content/search', {
      params: {
        cql: `type=page AND text ~ "${query}"`,
        limit,
        expand: 'space,version'
      }
    });
    return response.data.results;
  } catch (error) {
    console.error('Error searching pages:', error.message);
    throw error;
  }
}

/**
 * Lấy danh sách các trang con của một trang
 * @param {string} pageId - ID của trang cha
 * @returns {Promise<Array>} - Danh sách các trang con
 */
async function getChildPages(pageId) {
  try {
    const response = await confluenceApi.get(`/rest/api/content/${pageId}/child/page`);
    return response.data.results;
  } catch (error) {
    console.error('Error getting child pages:', error.message);
    throw error;
  }
}

/**
 * Tạo một trang mới trong Confluence
 * @param {string} spaceKey - Key của không gian làm việc
 * @param {string} title - Tiêu đề trang
 * @param {string} content - Nội dung trang (định dạng HTML)
 * @param {string} [parentId] - ID của trang cha (nếu có)
 * @returns {Promise<Object>} - Thông tin trang đã tạo
 */
async function createPage(spaceKey, title, content, parentId = null) {
  try {
    const pageData = {
      type: 'page',
      title: title,
      space: { key: spaceKey },
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      }
    };

    // Thêm trang cha nếu có
    if (parentId) {
      pageData.ancestors = [{ id: parentId }];
    }

    const response = await confluenceApi.post('/rest/api/content', pageData);
    return response.data;
  } catch (error) {
    console.error('Error creating page:', error.message);
    throw error;
  }
}

/**
 * Cập nhật một trang Confluence
 * @param {string} pageId - ID của trang cần cập nhật
 * @param {string} title - Tiêu đề mới
 * @param {string} content - Nội dung mới (định dạng HTML)
 * @param {number} version - Phiên bản hiện tại của trang
 * @returns {Promise<Object>} - Thông tin trang đã cập nhật
 */
async function updatePage(pageId, title, content, version) {
  try {
    // Lấy thông tin trang hiện tại
    const currentPage = await getPageById(pageId);
    
    const pageData = {
      id: pageId,
      type: 'page',
      title: title,
      space: { key: currentPage.space.key },
      body: {
        storage: {
          value: content,
          representation: 'storage'
        }
      },
      version: {
        number: version + 1
      }
    };

    const response = await confluenceApi.put(`/rest/api/content/${pageId}`, pageData);
    return response.data;
  } catch (error) {
    console.error('Error updating page:', error.message);
    throw error;
  }
}

/**
 * Xóa một trang Confluence
 * @param {string} pageId - ID của trang cần xóa
 * @returns {Promise<boolean>} - Kết quả xóa trang
 */
async function deletePage(pageId) {
  try {
    await confluenceApi.delete(`/rest/api/content/${pageId}`);
    return true;
  } catch (error) {
    console.error('Error deleting page:', error.message);
    throw error;
  }
}

/**
 * Lấy danh sách các không gian làm việc
 * @param {number} limit - Số lượng kết quả tối đa
 * @returns {Promise<Array>} - Danh sách các không gian làm việc
 */
async function getSpaces(limit = 25) {
  try {
    const response = await confluenceApi.get('/rest/api/space', {
      params: { limit }
    });
    return response.data.results;
  } catch (error) {
    console.error('Error getting spaces:', error.message);
    throw error;
  }
}

/**
 * Lấy cấu trúc của một không gian Confluence, bao gồm các thư mục và trang
 * @param {string} spaceKey - Key của không gian làm việc
 * @returns {Promise<Array>} - Cấu trúc không gian
 */
async function getSpaceStructure(spaceKey) {
  try {
    // Lấy tất cả các trang trong không gian
    const response = await confluenceApi.get('/rest/api/content', {
      params: {
        spaceKey: spaceKey,
        type: 'page',
        status: 'current',
        expand: 'ancestors,children.page,children.attachment,version',
        limit: 100
      }
    });
    
    // Nếu có nhiều hơn 100 trang, cần phải lấy thêm
    let allPages = response.data.results;
    let nextPageUrl = response.data._links && response.data._links.next;
    
    while (nextPageUrl) {
      // Lấy URL đầy đủ từ URL tương đối
      const fullNextUrl = `${confluenceApiBaseUrl}${nextPageUrl}`;
      const nextResponse = await axios.get(fullNextUrl, {
        headers: getAuthHeaders()
      });
      
      // Thêm kết quả vào danh sách
      allPages = allPages.concat(nextResponse.data.results);
      nextPageUrl = nextResponse.data._links && nextResponse.data._links.next;
    }
    
    return {
      results: allPages
    };
  } catch (error) {
    console.error('Error getting space structure:', error.message);
    throw error;
  }
}

/**
 * Tìm kiếm trang trong một không gian cụ thể
 * @param {string} spaceKey - Key của không gian làm việc
 * @param {string} query - Chuỗi tìm kiếm
 * @param {number} limit - Số lượng kết quả tối đa
 * @returns {Promise<Array>} - Danh sách các trang phù hợp
 */
async function searchPagesInSpace(spaceKey, query, limit = 20) {
  try {
    const response = await confluenceApi.get('/rest/api/content/search', {
      params: {
        cql: `type=page AND space="${spaceKey}" AND text ~ "${query}"`,
        limit,
        expand: 'space,version,ancestors'
      }
    });
    return response.data.results;
  } catch (error) {
    console.error('Error searching pages in space:', error.message);
    throw error;
  }
}

// Không export ở đây, chỉ export ở cuối file

/**
 * Lấy cấu trúc phân cấp trang từ Confluence (bao gồm cả trang con lồng nhau)
 * @param {string} pageId - ID của trang gốc
 * @returns {Promise<Object>} - Cấu trúc phân cấp trang
 */
async function getPageHierarchyTree(pageId) {
  try {
    // Lấy thông tin trang gốc và các trang con
    const rootPage = await getPageById(pageId);
    const childPages = await getChildPages(pageId);
    
    // Tạo cấu trúc trang gốc
    const pageTree = {
      id: rootPage.id,
      title: rootPage.title,
      type: 'page',
      url: rootPage._links ? `${rootPage._links.base}${rootPage._links.webui}` : '',
      spaceKey: rootPage.space?.key,
      spaceName: rootPage.space?.name,
      children: []
    };
    
    // Thêm các trang con vào cấu trúc trang gốc
    for (const childPage of childPages) {
      const childInfo = {
        id: childPage.id,
        title: childPage.title,
        type: 'page',
        url: childPage._links ? `${childPage._links.base}${childPage._links.webui}` : '',
        children: []
      };
      
      // Kiểm tra nếu trang con có các trang con khác
      const grandChildPages = await getChildPages(childPage.id);
      if (grandChildPages && grandChildPages.length > 0) {
        childInfo.hasChildren = true;
      }
      
      pageTree.children.push(childInfo);
    }
    
    // Log cấu trúc trang để debug
    console.log(`Page hierarchy tree for ${pageId}:`, JSON.stringify(pageTree, null, 2));
    
    return pageTree;
  } catch (error) {
    console.error('Error getting page hierarchy tree:', error.message);
    throw error;
  }
}

module.exports = {
  getPageById,
  searchPages,
  getChildPages,
  createPage,
  updatePage,
  deletePage,
  getSpaces,
  getSpaceStructure,
  searchPagesInSpace,
  getPageHierarchyTree
};
