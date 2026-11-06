"use client";

import {
  AlertCircle,
  Camera,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";

import { recordQrAttendance } from "../../actions";
import {
  formatAttendanceStatus,
  type QrAttendanceResult,
  type RecentQrScan,
} from "../../types";

type QrAttendanceScannerProps = {
  serviceId: string;
  initialRecent?: RecentQrScan[];
  serviceDetails?: ReactNode;
};

type ScannerState =
  | "starting"
  | "ready"
  | "processing"
  | "error"
  | "unavailable";

type ScannerControls = {
  stop: () => void;
};

export default function QrAttendanceScanner({
  serviceId, initialRecent = [], serviceDetails,
}: QrAttendanceScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<ScannerControls | null>(null);
  const processingRef = useRef(false);
  const cameraReadyRef = useRef(false);
  const resultTimerRef = useRef<number | null>(null);
  const submitQrValueRef = useRef<(value: string) => void>(() => {});
  const [scannerState, setScannerState] =
    useState<ScannerState>("starting");
  const [cameraMessage, setCameraMessage] = useState<string | null>(
    null,
  );
  const [result, setResult] = useState<QrAttendanceResult | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );
  const [recent,setRecent]=useState(initialRecent);
  const lastScanRef=useRef({value:"",time:0});
  const mountedRef=useRef(true);
  const [cameraAttempt, setCameraAttempt] = useState(0);

  async function submitQrValue(value: string) {
    if (processingRef.current) return;

    const normalizedValue = value.trim();

    if (!normalizedValue) return;
    if(lastScanRef.current.value===normalizedValue && Date.now()-lastScanRef.current.time<4000)return;
    lastScanRef.current={value:normalizedValue,time:Date.now()};

    processingRef.current = true;
    setScannerState("processing");
    setResult(null);
    setErrorMessage(null);

    if (resultTimerRef.current !== null) {
      window.clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }

    try {
      const nextResult = await recordQrAttendance(
        serviceId,
        normalizedValue,
      );

      if(!mountedRef.current)return;
      setResult(nextResult);
      if(nextResult.outcome==="recorded")setRecent(rows=>[{recordId:nextResult.recordId??nextResult.checkInTime,memberName:nextResult.memberName,attendanceStatus:nextResult.attendanceStatus,checkInTime:nextResult.checkInTime,visitingMember:nextResult.visitingMember??false,homeBranchName:nextResult.homeBranchName??"Home branch unknown"},...rows.filter(row=>row.recordId!==nextResult.recordId)].slice(0,20));
    } catch (error) {
      if(!mountedRef.current)return;
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The QR attendance scan could not be completed.",
      );
    } finally {
      processingRef.current=false;
      if(!mountedRef.current)return;
      setScannerState(cameraReadyRef.current?"ready":"error");
      resultTimerRef.current = window.setTimeout(() => {
        processingRef.current = false;
        setResult(null);
        setErrorMessage(null);
        setScannerState(
          cameraReadyRef.current ? "ready" : "error",
        );
      }, 2800);
    }
  }

  submitQrValueRef.current = submitQrValue;

  useEffect(() => {
    let disposed = false;

    cameraReadyRef.current = false;
    setScannerState("starting");
    setCameraMessage(null);

    const stopScanner = () => {
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    };

    const startCamera = async () => {
      const video = videoRef.current;

      if (!video) return;

      if (
        !window.isSecureContext &&
        !isLocalDevelopmentHost(window.location.hostname)
      ) {
        setScannerState("unavailable");
        setCameraMessage(
          "Camera access requires HTTPS. localhost is normally allowed, but a LAN IP development URL may not be treated as secure by the browser.",
        );
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerState("unavailable");
        setCameraMessage(
          "This browser does not provide camera access. Open this page in a camera-capable browser.",
        );
        return;
      }

      try {
        const { BrowserQRCodeReader } = await import(
          "@zxing/browser"
        );

        if (disposed) {
          return;
        }

        // The effect owns the single reader instance. Stopping stale
        // controls prevents retries or route transitions from leaving two
        // camera readers active at once.
        stopScanner();

        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: window.matchMedia("(pointer: coarse)").matches ? "environment" : "user" },
            },
          },
          video,
          (scanResult) => {
            if (
              disposed ||
              processingRef.current ||
              !scanResult
            ) {
              return;
            }

            void submitQrValueRef.current(scanResult.getText());
          },
        );

        if (disposed) {
          controls.stop();
          return;
        }

        scannerControlsRef.current = controls;
        cameraReadyRef.current = true;
        setScannerState("ready");
        setCameraMessage(
          "Point the camera at a member attendance QR code.",
        );
      } catch (error) {
        if (disposed) return;

        setScannerState("error");
        setCameraMessage(getCameraErrorMessage(error));
        stopScanner();
      }
    };

    void startCamera();

    return () => {
      disposed = true;
      cameraReadyRef.current = false;
      stopScanner();
    };
  }, [cameraAttempt, serviceId]);

  useEffect(() => {
    mountedRef.current=true;
    return () => {
      mountedRef.current=false;
      if (resultTimerRef.current !== null) {
        window.clearTimeout(resultTimerRef.current);
      }
    };
  }, []);

  const cameraStatus = getScannerStatus(scannerState);
  return <section aria-label="Member QR scanner" className="mx-auto w-full max-w-xl space-y-3 sm:space-y-4">
    <Card><CardContent className="space-y-3 p-3 sm:space-y-4 sm:p-5">
    {serviceDetails}
    <div className="text-center"><h2 className="text-lg font-semibold text-[#203264] sm:text-2xl"><span className="sm:hidden">Scan Member QR Code</span><span className="hidden sm:inline">Scan your Member QR Code</span></h2><p className="mt-1 text-sm text-slate-500">Position your QR code inside the frame</p></div>
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-950" data-scanner-frame>
      <video ref={videoRef} muted autoPlay playsInline className="h-full w-full object-cover" aria-label="Attendance QR camera" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-xl border border-white/30">
       {["left-0 top-0 border-l-4 border-t-4 rounded-tl-xl","right-0 top-0 border-r-4 border-t-4 rounded-tr-xl","left-0 bottom-0 border-l-4 border-b-4 rounded-bl-xl","right-0 bottom-0 border-r-4 border-b-4 rounded-br-xl"].map(c=><span key={c} className={`absolute h-10 w-10 border-primary ${c}`} />)}
      </div>
      {(scannerState==="starting"||scannerState==="error"||scannerState==="unavailable")&&<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/85 px-5 text-center text-white"><Camera className="h-10 w-10"/><p>{scannerState==="starting"?"Starting camera...":"Camera access is required to scan Member QR codes."}</p>{cameraMessage&&<p className="text-sm text-slate-200">{cameraMessage}</p>}{scannerState!=="starting"&&<Button variant="outline" className="text-slate-900" onClick={()=>setCameraAttempt(n=>n+1)}><RefreshCw/>Retry camera</Button>}</div>}
      {scannerState==="processing"&&<p role="status" className="absolute bottom-4 left-4 right-4 rounded-xl bg-slate-900/90 p-3 text-center text-white">Checking Member attendance...</p>}
    </div>
    <div className="text-center"><StatusBadge variant={cameraStatus.variant}>{cameraStatus.label}</StatusBadge></div>
    <div aria-live="polite" aria-atomic="true" className="min-h-[100px]">
     {result?<div role="status" className={`flex items-start gap-3 rounded-xl border p-4 ${result.outcome==="recorded"?"border-[#B0F2B4] bg-green-50 text-green-950":"border-[#FFC43D] bg-amber-50 text-amber-950"}`}>
       {result.outcome==="recorded"?<CheckCircle2 className="h-7 w-7 shrink-0"/>:<AlertCircle className="h-7 w-7 shrink-0"/>}
       <div><p className="text-lg font-semibold sm:text-2xl">{result.memberName}</p><p className="font-medium">{result.outcome==="recorded"?"Present recorded":"Already Scanned"}</p>{result.outcome==="duplicate"&&<p className="text-sm">Attendance already recorded as {formatAttendanceStatus(result.attendanceStatus)}.</p>}{result.visitingMember&&<p className="mt-1 text-sm">Visiting Member · {result.homeBranchName}</p>}</div>
     </div>:errorMessage?<div role="alert" className="flex gap-3 rounded-xl border border-[#EF476F] bg-red-50 p-4 text-red-900"><AlertCircle className="h-6 w-6 shrink-0"/><div><p className="font-semibold">Scan could not be recorded</p><p>{errorMessage}</p></div></div>:<p className="py-5 text-center text-sm text-slate-500">Ready for the next Member.</p>}
    </div>
    </CardContent></Card>
    <section aria-label="Recently Scanned" className="rounded-2xl border border-slate-200 bg-white p-3"><h3 className="text-sm font-semibold text-[#203264]">Recently Scanned</h3>
      {recent.length?<ul className="mt-2 divide-y divide-slate-100">{recent.map(row=><li key={row.recordId} className="py-2"><p className="text-sm font-medium leading-5 text-slate-900">{row.memberName}</p><p className="text-[11px] leading-4 text-slate-500">{formatAttendanceStatus(row.attendanceStatus)}{row.checkInTime?` · ${formatCheckInTime(row.checkInTime)}`:""}</p>{row.visitingMember&&<p className="mt-0.5 text-[11px] leading-4 font-medium text-[#365FA6]">Visiting Member · {row.homeBranchName}</p>}</li>)}</ul>:<p className="py-3 text-xs text-slate-500">No QR scans recorded for this Service yet.</p>}
    </section>
  </section>;
}

function getCameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Camera permission was denied. Allow camera access in browser settings, then retry.";
    }

    if (error.name === "NotFoundError") {
      return "No camera was found. Connect a camera, then retry.";
    }

    if (error.name === "NotReadableError") {
      return "The camera is in use or unavailable. Close other camera apps, then retry.";
    }

    if (error.name === "OverconstrainedError") {
      return "The preferred camera is unavailable. Check your device and camera permissions.";
    }
  }

  return "The camera could not be started. Check permissions and try again.";
}

function isLocalDevelopmentHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

function getScannerStatus(state: ScannerState) {
  if (state === "ready") {
    return { label: "Ready to scan", variant: "success" as const };
  }

  if (state === "processing") {
    return { label: "Checking...", variant: "info" as const };
  }

  if (state === "starting") {
    return { label: "Starting camera", variant: "warning" as const };
  }

  return { label: "Camera unavailable", variant: "danger" as const };
}

function formatCheckInTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });
}
