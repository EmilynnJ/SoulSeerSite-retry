/**
 * Utility for making API requests with unified error handling
 */

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
  body?: any;
}

/**
 * Makes an API request with consistent error handling
 * 
 * @param url - The API endpoint URL (will be prefixed with /api/ if not already)
 * @param options - Fetch options including method, headers, body
 * @returns Promise resolving to the JSON response or null if error
 */
const apiRequest = async (url: string, options: RequestOptions = {}): Promise<any> => {
  // Ensure URL is properly formatted
  const apiUrl = url.startsWith('/api/') || url.startsWith('/auth/') 
    ? url 
    : `/api${url.startsWith('/') ? '' : '/'}${url}`;
  
  // Prepare headers with content type if sending JSON
  const headers: Record<string, string> = {
    ...options.headers,
  };
  
  // If body is an object, stringify it and set content type
  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    body = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }
  
  try {
    const response = await fetch(apiUrl, {
      ...options,
      headers,
      body,
      credentials: 'include' // Include cookies for authentication
    });
    
    // Handle HTTP error status
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.message || response.statusText || 'API request failed';
      
      console.error(`API Error (${response.status}):`, errorMessage, {
        url: apiUrl,
        status: response.status,
        details: errorData
      });
      
      // Return structured error object
      return {
        error: errorMessage,
        status: response.status,
        details: errorData
      };
    }
    
    // For 204 No Content responses, return empty object
    if (response.status === 204) {
      return {};
    }
    
    // Parse and return JSON response
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    
    // Return error object
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 0, // Network/client error
      details: error
    };
  }
};

export default apiRequest;