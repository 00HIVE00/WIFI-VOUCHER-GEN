import { useState } from 'react'
import CSVUpload from './components/CSVUpload'
import DesignCanvas from './components/DesignCanvas'
import StylingControls from './components/StylingControls'
import ExportPDF from './components/ExportPDF'
import PagePreview from './components/PagePreview'
import ChatAssistant from './components/ChatAssistant'

function App() {
  const [voucherCodes, setVoucherCodes] = useState([])
  const [backgroundImage, setBackgroundImage] = useState(null)
  const [textPosition, setTextPosition] = useState({ x: 200, y: 500 })
  const [textStyle, setTextStyle] = useState({
    color: '#000000',
    fontSize: 24,
    fontWeight: 'normal'
  })
  const [layoutSettings, setLayoutSettings] = useState({
    paperSize: 'a4',
    columns: 2,
    rows: 5,
    margin: 5,
    spacing: 2
  })
  const [imageTransform, setImageTransform] = useState({
    left: 0,
    top: 0,
    scaleX: 1,
    scaleY: 1
  })
  const [qrCodePosition, setQrCodePosition] = useState({ x: 50, y: 50 })
  const [qrCodeSize, setQrCodeSize] = useState(60)

  return (
    <div className="h-screen overflow-hidden bg-gray-900 text-gray-100">
      <div className="h-full w-full px-3 lg:px-4 py-3 flex flex-col min-h-0">
        <header className="shrink-0 mb-4">
          <h1 className="text-4xl font-bold text-center mb-2">
            UniFi Voucher Designer
          </h1>
          <p className="text-center text-gray-400">
            Design and generate professional voucher codes as PDF
          </p>
        </header>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
          {/* Left Sidebar - Controls */}
          <div className="min-h-0 overflow-hidden">
            <div className="h-full overflow-auto pr-1 space-y-4">
              <CSVUpload onCodesLoaded={setVoucherCodes} />
              <StylingControls
                style={textStyle}
                onStyleChange={setTextStyle}
              />
              <ExportPDF
                voucherCodes={voucherCodes}
                backgroundImage={backgroundImage}
                textPosition={textPosition}
                textStyle={textStyle}
                layoutSettings={layoutSettings}
                onLayoutChange={setLayoutSettings}
                imageTransform={imageTransform}
                qrCodePosition={qrCodePosition}
                qrCodeSize={qrCodeSize}
              />
            </div>
          </div>

          {/* Center - Canvas */}
          <div className="min-h-0 overflow-hidden">
            <div className="h-full overflow-auto pr-1">
            <DesignCanvas
              backgroundImage={backgroundImage}
              onImageUpload={setBackgroundImage}
              textPosition={textPosition}
              onPositionChange={setTextPosition}
              textStyle={textStyle}
              voucherCodes={voucherCodes}
              qrCodePosition={qrCodePosition}
              onQrCodePositionChange={setQrCodePosition}
              qrCodeSize={qrCodeSize}
              onQrCodeSizeChange={setQrCodeSize}
            />
            </div>
          </div>

          {/* Right - Preview */}
          <div className="min-h-0 overflow-hidden">
            <div className="h-full overflow-auto pr-1">
            <PagePreview
              voucherCodes={voucherCodes}
              backgroundImage={backgroundImage}
              textPosition={textPosition}
              onPositionChange={setTextPosition}
              textStyle={textStyle}
              onStyleChange={setTextStyle}
              layoutSettings={layoutSettings}
              imageTransform={imageTransform}
              onImageTransformChange={setImageTransform}
              qrCodePosition={qrCodePosition}
              onQrCodePositionChange={setQrCodePosition}
              qrCodeSize={qrCodeSize}
              onQrCodeSizeChange={setQrCodeSize}
            />
            </div>
          </div>
        </div>
      </div>
      
      {/* AI Chat Assistant */}
      <ChatAssistant />

      {/* Floating link to ChatGPT conversation */}
      <a
        href="https://chatgpt.com/c/698048b5-05b0-8324-88ad-28889f6cd901"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-24 bg-gray-800 hover:bg-gray-700 text-white rounded-full px-4 py-3 shadow-lg border border-gray-700 z-50 transition-all inline-flex items-center gap-2"
        title="Open your ChatGPT conversation in a new tab"
      >
        <span className="text-sm font-semibold">ChatGPT</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7m0-7L10 14m-4 7h11a2 2 0 002-2V11" />
        </svg>
      </a>
    </div>
  )
}

export default App

