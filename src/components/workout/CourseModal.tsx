import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CourseRoute, UserProfile } from '../../types';
import { courseService } from '../../services/courseService';
import { GPXParser } from '../../services/gpxParser';
import { formatDistance } from '../../utils/formatters';
import {
  Navigation,
  UploadCloud,
  Check,
  Trash2,
  MapPin,
  TrendingUp,
  X,
  FileText,
  Sparkles,
  Route,
  AlertCircle,
  Flag,
  Download,
  ChevronRight,
} from 'lucide-react';
import { downloadFile, generateCourseGPX } from '../../utils/exportGenerators';

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCourse?: (course: CourseRoute | null) => void;
  profile?: UserProfile | null;
}

export const CourseModal: React.FC<CourseModalProps> = ({
  isOpen,
  onClose,
  onSelectCourse,
  profile,
}) => {
  const [courses, setCourses] = useState<CourseRoute[]>(() => courseService.getSavedCourses());
  const [activeCourse, setActiveCourse] = useState<CourseRoute | null>(() => courseService.getActiveCourse());
  const [activeTab, setActiveTab] = useState<'routes' | 'upload'>('routes');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [previewCourse, setPreviewCourse] = useState<CourseRoute | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Right-side Drawer slide animation & drag gesture states
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const distanceUnit = profile?.distance_unit || 'km';

  // Smooth slide-in/out transition
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setDragOffsetX(0);
      setCourses(courseService.getSavedCourses());
      setActiveCourse(courseService.getActiveCourse());
      setUploadError(null);
      setPreviewCourse(null);

      // Trigger slide animation from right to left
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });

      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = origOverflow;
      };
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setDragOffsetX(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 280);
  }, [onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    if (deltaX > 0) {
      setDragOffsetX(deltaX);
    }
  };

  const handleTouchEnd = () => {
    if (dragOffsetX > 110) {
      handleClose();
    } else {
      setDragOffsetX(0);
    }
    touchStartX.current = null;
  };

  if (!isRendered) return null;

  const handleSelect = (course: CourseRoute | null) => {
    courseService.setActiveCourse(course);
    setActiveCourse(course);
    if (onSelectCourse) {
      onSelectCourse(course);
    }
    handleClose();
  };

  const handleClear = () => {
    courseService.setActiveCourse(null);
    setActiveCourse(null);
    if (onSelectCourse) {
      onSelectCourse(null);
    }
  };

  const handleDelete = (e: React.MouseEvent, courseId: string) => {
    e.stopPropagation();
    courseService.deleteCourse(courseId);
    setCourses(courseService.getSavedCourses());
    if (activeCourse?.id === courseId) {
      setActiveCourse(null);
      if (onSelectCourse) onSelectCourse(null);
    }
  };

  const handleFileProcess = async (file: File) => {
    setUploadError(null);
    setIsParsing(true);
    try {
      const parsed = await GPXParser.parseFile(file);
      setPreviewCourse(parsed);
    } catch (err: any) {
      console.error('GPX parse error:', err);
      setUploadError(err.message || 'Failed to parse GPX/TCX file. Ensure it contains a valid track.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleConfirmUpload = () => {
    if (!previewCourse) return;
    const saved = courseService.saveCourse(previewCourse);
    setCourses(courseService.getSavedCourses());
    handleSelect(saved);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-hidden select-none">
      {/* Dark Blur Backdrop */}
      <div
        onClick={handleClose}
        className={`fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300 ease-out cursor-pointer ${isAnimating ? 'opacity-100' : 'opacity-0'
          }`}
      />

      {/* Right Drawer Sliding Container (slides from right to left) */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: !isAnimating
            ? 'translateX(100%)'
            : dragOffsetX > 0
              ? `translateX(${dragOffsetX}px)`
              : 'translateX(0)',
        }}
        className="fixed inset-y-0 right-0 z-[10000] w-full max-w-md sm:max-w-lg h-[100dvh] bg-white dark:bg-slate-900 border-l border-emerald-100 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden transition-transform duration-300 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle swipe handle indicator on drawer edge */}
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-10 rounded-full bg-slate-300/70 dark:bg-slate-700/70 hidden sm:block pointer-events-none" />

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Navigation size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-display text-lg font-black text-slate-950 dark:text-white leading-tight">
                Course Navigation
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Follow GPX courses & get real-time off-route alerts
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
            aria-label="Close drawer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-2 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800/60 gap-1 shrink-0">
          <button
            onClick={() => setActiveTab('routes')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'routes'
              ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
          >
            <Route size={14} />
            <span>Courses Library ({courses.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${activeTab === 'upload'
              ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
          >
            <UploadCloud size={14} />
            <span>Upload GPX / TCX</span>
          </button>
        </div>

        {/* Drawer Body (Scrollable Content) */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 overscroll-contain">
          {activeTab === 'routes' && (
            <div className="space-y-3">
              {/* Course List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Available Routes ({courses.length})
                  </span>
                  {activeCourse && (
                    <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                      <span>1 Course Active</span>
                    </span>
                  )}
                </div>

                {courses.map((course) => {
                  const isCurrent = activeCourse?.id === course.id;
                  return (
                    <div
                      key={course.id}
                      onClick={() => {
                        if (isCurrent) {
                          handleClear();
                        } else {
                          handleSelect(course);
                        }
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${isCurrent
                        ? 'bg-cyan-50/70 dark:bg-cyan-950/30 border-cyan-400 dark:border-cyan-500/70 shadow-sm ring-1 ring-cyan-400/30 dark:ring-cyan-500/20'
                        : 'bg-white dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 border-slate-200/80 dark:border-slate-800'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-bold text-sm text-slate-950 dark:text-white truncate">
                              {course.name}
                            </h4>
                            {course.source === 'preset' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 shrink-0">
                                Preset
                              </span>
                            )}
                            {course.source === 'saved_workout' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 shrink-0">
                                Re-Run
                              </span>
                            )}
                          </div>

                          {course.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                              {course.description}
                            </p>
                          )}

                          <div className="flex items-center gap-3 mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-bold">
                              <MapPin size={12} />
                              {formatDistance(course.totalDistanceMeters, distanceUnit)}
                            </span>
                            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                              <TrendingUp size={12} />
                              +{course.elevationGainMeters}m
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {course.points.length} pts
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isCurrent ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClear();
                              }}
                              className="py-1.5 px-3 rounded-xl bg-cyan-500 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm shadow-cyan-500/25 group/btn"
                              title="Selected course. Tap to clear selection"
                            >
                              <Check size={12} strokeWidth={3} className="group-hover/btn:hidden" />
                              <X size={12} strokeWidth={3} className="hidden group-hover/btn:inline-block" />
                              <span className="group-hover/btn:hidden">Selected</span>
                              <span className="hidden group-hover/btn:inline-block">Clear</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelect(course);
                              }}
                              className="py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-cyan-500 hover:text-white text-slate-700 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer active:scale-95"
                            >
                              Select
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const gpx = generateCourseGPX(course);
                              downloadFile(gpx, `${course.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.gpx`, 'application/gpx+xml');
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 transition-all cursor-pointer"
                            title="Download course as GPX"
                          >
                            <Download size={13} />
                          </button>

                          {course.source !== 'preset' && (
                            <button
                              type="button"
                              onClick={(e) => handleDelete(e, course.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
                              title="Delete route"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              {/* Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 sm:p-8 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isDragging
                  ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/30 scale-[0.99]'
                  : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-950/40 hover:border-cyan-400 dark:hover:border-cyan-500/60'
                  }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".gpx,.tcx,.xml"
                  className="hidden"
                />

                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-3">
                  <UploadCloud size={28} />
                </div>

                <h4 className="font-bold text-sm text-slate-950 dark:text-white">
                  Drop your GPX or TCX file here
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                  Upload trail or race routes from AllTrails, Strava, Garmin Connect, or Komoot.
                </p>

                <div className="mt-4 px-3.5 py-1.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Select File (.gpx / .tcx)
                </div>
              </div>

              {/* Parsing State */}
              {isParsing && (
                <div className="p-3 text-center text-xs font-semibold text-cyan-600 dark:text-cyan-400 animate-pulse">
                  Analyzing route waypoints and elevation profile…
                </div>
              )}

              {/* Error Message */}
              {uploadError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 flex items-start gap-2.5 text-rose-700 dark:text-rose-400 text-xs">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <p>{uploadError}</p>
                </div>
              )}

              {/* Preview Card */}
              {previewCourse && (
                <div className="p-4 rounded-2xl bg-cyan-50/80 dark:bg-cyan-950/30 border border-cyan-300 dark:border-cyan-500/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
                      Route Detected Successfully
                    </span>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {previewCourse.points.length} GPS Points
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-base text-slate-950 dark:text-white">
                      {previewCourse.name}
                    </h4>
                    {previewCourse.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                        {previewCourse.description}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-cyan-100 dark:border-cyan-900/50">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Distance</div>
                      <div className="text-sm font-black text-slate-950 dark:text-white mt-0.5">
                        {formatDistance(previewCourse.totalDistanceMeters, distanceUnit)}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-cyan-100 dark:border-cyan-900/50">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Elev Gain</div>
                      <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                        +{previewCourse.elevationGainMeters}m
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-cyan-100 dark:border-cyan-900/50">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Elev Loss</div>
                      <div className="text-sm font-black text-rose-500 dark:text-rose-400 mt-0.5">
                        -{previewCourse.elevationLossMeters}m
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleConfirmUpload}
                    className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs shadow-md shadow-cyan-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                  >
                    <Check size={15} strokeWidth={2.5} />
                    <span>Save Course & Start Navigating</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <span>Standard GPX 1.1 & Garmin TCX</span>
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
