import { createContext, useContext, useState, useRef } from 'react';

const CodeReviewScanContext = createContext(null);

export function CodeReviewScanProvider({ children }) {
  const [results, setResults] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanEngagementId, setScanEngagementId] = useState(null);
  const [resultsEngagementId, setResultsEngagementId] = useState(null);
  const [activeJobId, setActiveJobId] = useState(null);
  // jobFiles: array of { id, filename, status, result_id, result_content, error_message }
  const [jobFiles, setJobFiles] = useState([]);
  const abortRef = useRef(null);
  const keyCounterRef = useRef(0);
  const seenResultIds = useRef(new Set());

  return (
    <CodeReviewScanContext.Provider
      value={{
        results, setResults,
        scanning, setScanning,
        scanEngagementId, setScanEngagementId,
        resultsEngagementId, setResultsEngagementId,
        activeJobId, setActiveJobId,
        jobFiles, setJobFiles,
        abortRef, keyCounterRef, seenResultIds,
      }}
    >
      {children}
    </CodeReviewScanContext.Provider>
  );
}

export const useCodeReviewScan = () => useContext(CodeReviewScanContext);
