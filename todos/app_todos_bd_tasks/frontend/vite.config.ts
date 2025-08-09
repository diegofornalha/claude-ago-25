import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  
  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2
      },
      mangle: {
        safari10: true
      },
      format: {
        comments: false
      }
    },
    
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'db-vendor': ['@electric-sql/pglite', 'drizzle-orm'],
          'ui-vendor': ['@tanstack/react-query', 'date-fns', 'zod']
        },
        
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    cssCodeSplit: true,
    reportCompressedSize: false,
    assetsInlineLimit: 4096
  },
  
  optimizeDeps: {
    include: ['react', 'react-dom', 'drizzle-orm'],
    exclude: ['@electric-sql/pglite']
  },
  
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@utils': '/src/utils',
      '@hooks': '/src/hooks'
    }
  }
})
