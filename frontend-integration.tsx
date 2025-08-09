// Frontend Integration for MCP RAG Cache
// Add this to your React component

import { useEffect, useState } from 'react';

const RAG_CACHE_URL = '/mcp-rag-cache/frontend-documents.json';

export function useMCPDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch(RAG_CACHE_URL)
      .then(res => res.json())
      .then(data => {
        setDocuments(data.documents || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading MCP documents:', err);
        setLoading(false);
      });
  }, []);
  
  return { documents, loading };
}

// Usage in component:
// const { documents, loading } = useMCPDocuments();
