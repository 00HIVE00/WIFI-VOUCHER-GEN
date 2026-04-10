import { useState } from 'react'
import Papa from 'papaparse'
import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker - use CDN for worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
}

function CSVUpload({ onCodesLoaded }) {
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const extractCodesFromText = (text) => {
    // Extract voucher codes that visually look like 00000-00000,
    // even if the PDF splits digits into multiple chunks with weird separators.
    // Still ignore plain 10-digit numbers like 0000000000.
    console.log('🔍 Starting code extraction (token-based)...')
    console.log('Original text length:', text.length)

    const codes = []

    // 1) Strict matches: exactly 00000-00000
    const strictMatches = text.match(/\b\d{5}-\d{5}\b/g) || []
    console.log(`✅ Strict matches (00000-00000): ${strictMatches.length}`)
    strictMatches.forEach((m) => codes.push(m.trim()))

    // 2) Token-based reconstruction:
    //    - Find all digit "tokens" (1–5 digits) with positions.
    //    - Walk forward combining nearby tokens until we have 10 digits.
    //    - Require at least 2 tokens (so we don't accept a single 10-digit run like 0000000000).
    const digitTokenRegex = /\d{1,5}/g
    const tokenMatches = [...text.matchAll(digitTokenRegex)]
    console.log(`🔎 Found ${tokenMatches.length} digit tokens`)

    for (let i = 0; i < tokenMatches.length; i++) {
      let digits = tokenMatches[i][0]
      let lastEnd = tokenMatches[i].index + tokenMatches[i][0].length
      const group = [tokenMatches[i]]

      // Skip if first token already has 10 digits (plain 0000000000 style)
      if (digits.length >= 10) continue

      for (let j = i + 1; j < tokenMatches.length && digits.length < 10; j++) {
        const next = tokenMatches[j]
        const gap = next.index - lastEnd

        // Only combine tokens that are reasonably close in the text
        if (gap > 10) break

        digits += next[0]
        lastEnd = next.index + next[0].length
        group.push(next)
      }

      if (digits.length === 10 && group.length > 1) {
        const formatted = digits.slice(0, 5) + '-' + digits.slice(5)
        codes.push(formatted)
      }
    }

    // Filter out obvious false positives (speeds, data limits)
    const filteredCodes = codes.filter(code => {
        const codeDigits = code.replace(/-/g, '')
        
        // Exclude if code appears right before speed units
        const speedPattern = new RegExp(`${codeDigits}\\s*(?:mbps|mb|gb|kb|bps)`, 'i')
        if (speedPattern.test(text)) {
          console.log(`Filtered out speed: ${code}`)
          return false
        }
        
        // Exclude if code appears in data limit context
        const dataPattern = new RegExp(`(?:limit|data|speed|download|upload)\\s*:?\\s*[^\\d]*${codeDigits}\\s*(?:mb|gb|tb)`, 'i')
        if (dataPattern.test(text)) {
          console.log(`Filtered out data limit: ${code}`)
          return false
        }
        
        // Only exclude numbers >= 1,000,000 (clearly data limits)
        const codeNum = parseInt(codeDigits)
        if (codeNum >= 1000000) {
          console.log(`Filtered out large number: ${code}`)
          return false
        }
        
        return true
      })
      // Remove duplicates
      .filter((code, index, self) => self.indexOf(code) === index)
      // Sort for consistency
      .sort()
    
    console.log(`Final codes after filtering: ${filteredCodes.length}`)
    if (filteredCodes.length < 100) {
      console.warn(`⚠️ Only found ${filteredCodes.length} codes, expected 100`)
      console.log('Sample of found codes:', filteredCodes.slice(0, 10))
    }

    return filteredCodes
  }

  const handlePDFUpload = async (file) => {
    setIsProcessing(true)
    setError('')

    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      
      let allText = ''
      
      // Extract text from all pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map(item => item.str).join(' ')
        allText += pageText + ' '
      }

      // Debug: Log extracted text (first 500 chars) to help diagnose
      console.log('Extracted PDF text (first 500 chars):', allText.substring(0, 500))

      // Extract voucher codes from the text
      const codes = extractCodesFromText(allText)
      
      console.log('=== PDF CODE EXTRACTION RESULTS ===')
      console.log('Total codes found:', codes.length)
      console.log('Codes:', codes)
      
      // Show first and last few codes for verification
      if (codes.length > 0) {
        console.log('First 5 codes:', codes.slice(0, 5))
        console.log('Last 5 codes:', codes.slice(-5))
        console.log('Expected: 100 codes')
        if (codes.length < 100) {
          console.warn(`⚠️ Only found ${codes.length} codes, expected 100. Some codes may have been filtered out.`)
        }
      } else {
        console.warn('No codes found. Check if PDF contains codes in format 00000-00000')
      }

      if (codes.length === 0) {
        // Show more helpful error message with sample of extracted text
        const sampleText = allText.substring(0, 200).replace(/\s+/g, ' ')
        setError(`No valid voucher codes found in PDF. Expected format: 00000-00000. Extracted text sample: "${sampleText}..."`)
        setIsProcessing(false)
      } else {
        onCodesLoaded(codes)
        setIsProcessing(false)
      }
    } catch (error) {
      console.error('Error parsing PDF:', error)
      setError('Error parsing PDF file: ' + error.message)
      setIsProcessing(false)
    }
  }

  const handleCSVUpload = (file) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const codes = results.data
          .flat()
          .filter(code => code && code.trim())
          .map(code => {
            // Clean and validate UniFi code format (00000-00000)
            const cleaned = code.trim().replace(/\s+/g, '')
            // Accept ONLY codes that already contain a dash in the format 00000-00000
            if (/^\d{5}-\d{5}$/.test(cleaned)) {
              return cleaned
            }
            return null
          })
          .filter(code => code !== null)

        if (codes.length === 0) {
          setError('No valid voucher codes found. Expected format: 00000-00000')
        } else {
          onCodesLoaded(codes)
        }
        setIsProcessing(false)
      },
      error: (error) => {
        setError('Error parsing CSV file: ' + error.message)
        setIsProcessing(false)
      }
    })
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Validate file type
    const fileName = file.name.toLowerCase()
    const isValidCSV = fileName.endsWith('.csv') || fileName.endsWith('.txt')
    const isValidPDF = fileName.endsWith('.pdf')
    
    if (!isValidCSV && !isValidPDF) {
      setError('Please select a CSV, TXT, or PDF file')
      setFileName('')
      return
    }

    setFileName(file.name)
    setError('')
    setIsProcessing(true)

    if (isValidPDF) {
      await handlePDFUpload(file)
    } else {
      handleCSVUpload(file)
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-xl font-semibold mb-4">Upload Voucher Codes</h2>
      
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm text-gray-400 mb-2 block">
            CSV or PDF File (10-digit format: 00000-00000)
          </span>
          <input
            type="file"
            accept=".csv,text/csv,text/plain,.txt,.pdf,application/pdf"
            onChange={handleFileUpload}
            disabled={isProcessing}
            className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </label>

        {isProcessing && (
          <div className="text-sm text-blue-400">
            ⏳ Processing {fileName}...
          </div>
        )}

        {fileName && !isProcessing && (
          <div className="text-sm text-green-400">
            ✓ Loaded: {fileName}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-400 bg-red-900/20 p-3 rounded">
            {error}
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-700">
          <p>📄 CSV/TXT: One code per line</p>
          <p>📑 PDF: Codes will be automatically scanned and extracted</p>
          <p>🔢 Format: 00000-00000 (dash required)</p>
        </div>
      </div>
    </div>
  )
}

export default CSVUpload

