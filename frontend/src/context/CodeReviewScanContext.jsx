import { createContext, useContext, useState, useRef } from 'react';

const CodeReviewScanContext = createContext(null);

export function CodeReviewScanProvider({ children }) {
  const [results, setResults] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanEngagementId, setScanEngagementId] = useState(null);
  const [resultsEngagementId, setResultsEngagementId] = useState(null);
  const abortRef = useRef(null);
  const keyCounterRef = useRef(0);

  return (
    <CodeReviewScanContext.Provider
      value={{ results, setResults, scanning, setScanning, scanEngagementId, setScanEngagementId, resultsEngagementId, setResultsEngagementId, abortRef, keyCounterRef }}
    >
      {children}
    </CodeReviewScanContext.Provider>
  );
}

export const useCodeReviewScan = () => useContext(CodeReviewScanContext);
