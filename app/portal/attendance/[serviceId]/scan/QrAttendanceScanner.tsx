"use client";

import {
  AlertCircle,
  Camera,
  CheckCircle2,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";

import { recordQrAttendance } from "../../actions";
import {
  formatAttendanceStatus,
  type QrAttendanceResult,
} from "../../types";

type QrAttendanceScannerProps = {
  serviceId: string;
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
  serviceId,
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
  const [manualValue, setManualValue] = useState("");
  const [cameraAttempt, setCameraAttempt] = useState(0);

  async function submitQrValue(value: string) {
    if (processingRef.current) return;

    const normalizedValue = value.trim();

    if (!normalizedValue) {
      setErrorMessage("Enter or scan a member QR value.");
      return;
    }

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

      setResult(nextResult);
      setManualValue("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The QR attendance scan could not be completed.",
      );
    } finally {
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
          "This browser does not provide camera access. Use the manual QR value below.",
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
              facingMode: { ideal: "environment" },
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
    return () => {
      if (resultTimerRef.current !== null) {
        window.clearTimeout(resultTimerRef.current);
      }
    };
  }, []);

  function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitQrValue(manualValue);
  }

  const cameraStatus = getScannerStatus(scannerState);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>QR Check-in</CardTitle>
            <CardDescription>
              Scan the opaque member QR code. The member name and branch
              eligibility are verified on the server.
            </CardDescription>
          </div>

          <StatusBadge variant={cameraStatus.variant}>
            {cameraStatus.label}
          </StatusBadge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-950">
          <video
            ref={videoRef}
            muted
            autoPlay
            playsInline
            className="h-full w-full object-cover"
            aria-label="Attendance QR camera"
          />

          {scannerState !== "ready" &&
            scannerState !== "processing" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/85 px-6 text-center text-white">
                <Camera className="h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-200">
                  {scannerState === "starting"
                    ? "Starting camera..."
                    : "Camera scanning is unavailable"}
                </p>
              </div>
            )}

          {scannerState === "processing" && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 px-6 text-center text-white">
              <p className="rounded-xl bg-slate-900/90 px-4 py-3 text-sm">
                Checking member attendance...
              </p>
            </div>
          )}
        </div>

        {cameraMessage && (
          <p className="text-sm text-slate-500">
            {cameraMessage}
          </p>
        )}

        {(scannerState === "error" ||
          scannerState === "unavailable") && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCameraAttempt((attempt) => attempt + 1)}
          >
            <RefreshCw />
            Try Camera Again
          </Button>
        )}

        {result?.outcome === "recorded" && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Attendance recorded</p>
              <p className="mt-1">
                {result.memberName} was checked in as present.
              </p>
            </div>
          </div>
        )}

        {result?.outcome === "duplicate" && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Already checked in</p>
              <p className="mt-1">
                {result.memberName} already has a{" "}
                {formatAttendanceStatus(result.attendanceStatus).toLowerCase()}{" "}
                record for this service. The existing record was not changed.
              </p>
              {result.checkInTime && (
                <p className="mt-1 text-xs">
                  Checked in at {formatCheckInTime(result.checkInTime)}.
                </p>
              )}
            </div>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        )}

        <form
          onSubmit={handleManualSubmit}
          className="border-t border-slate-200 pt-5"
        >
          <FormField
            label="Manual QR Value"
            htmlFor="manual-qr-value"
            description="Use this fallback for desktop testing, camera permission problems, or unsupported browsers."
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                id="manual-qr-value"
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                placeholder="Paste the member QR value"
                disabled={scannerState === "processing"}
                autoComplete="off"
              />

              <Button
                type="submit"
                variant="outline"
                disabled={
                  scannerState === "processing" ||
                  !manualValue.trim()
                }
              >
                <QrCode />
                Check In
              </Button>
            </div>
          </FormField>
        </form>
      </CardContent>
    </Card>
  );
}

function getCameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Camera permission was denied. Allow camera access or use the manual QR value below.";
    }

    if (error.name === "NotFoundError") {
      return "No camera was found on this device. Use the manual QR value below.";
    }

    if (error.name === "NotReadableError") {
      return "The camera is already in use or unavailable. Use the manual QR value below.";
    }

    if (error.name === "OverconstrainedError") {
      return "The preferred rear camera is unavailable. Check camera permissions or use the manual QR value below.";
    }
  }

  return "The camera could not be started. Use the manual QR value below or try again.";
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

  return { label: "Manual fallback available", variant: "danger" as const };
}

function formatCheckInTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
