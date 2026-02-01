
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { INITIAL_QUESTIONS, SYMBOLS } from './constants';
import { Question, ViewState, DiagnosisResult } from './types';
import { diagnoseSolutionText, analyzeSolutionImage } from './services/gemini';
import { 
  PlayCircle, 
  FileCode, 
  PhoneCall, 
  Award, 
  Home, 
  ChevronLeft, 
  ChevronRight, 
  PenTool, 
  Eraser, 
  Trash2, 
  CheckCircle, 
  X, 
  Mic, 
  MicOff,
  Cpu,
  Eye,
  EyeOff,
  LayoutGrid,
  Info
} from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.START);
  const [questions, setQuestions] = useState<Question[]>(INITIAL_QUESTIONS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>(new Array(INITIAL_QUESTIONS.length).fill(""));
  const [solvedStatus, setSolvedStatus] = useState<boolean[]>(new Array(INITIAL_QUESTIONS.length).fill(false));
  const [showTargets, setShowTargets] = useState(false);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult[] | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [activeSymbolTab, setActiveSymbolTab] = useState<'curriculum' | 'math'>('curriculum');
  const [showMap, setShowMap] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [jsonInput, setJsonInput] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number, y: number } | null>(null);
  const recognitionRef = useRef<any>(null);

  const currentQuestion = questions[currentIndex];

  // إعداد التعرف على الصوت
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'ar-IQ';
      recognitionRef.current.continuous = false;
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        updateAnswer(userAnswers[currentIndex] + " " + transcript);
        setIsListening(false);
      };
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onerror = () => setIsListening(false);
    }
  }, [currentIndex, userAnswers]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("متصفحك لا يدعم التعرف على الصوت.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const updateAnswer = (val: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentIndex] = val;
    setUserAnswers(newAnswers);
  };

  const startExam = () => {
    setView(ViewState.EXAM);
    setCurrentIndex(0);
    setSolvedStatus(new Array(questions.length).fill(false));
    setUserAnswers(new Array(questions.length).fill(""));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setDiagnosis(null);
      setIsCanvasOpen(false);
      setShowTargets(false);
    } else {
      setView(ViewState.RESULT);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setDiagnosis(null);
      setIsCanvasOpen(false);
      setShowTargets(false);
    }
  };

  const calculateFinalScore = () => {
    const solvedCount = solvedStatus.filter(Boolean).length;
    return Math.round((solvedCount / questions.length) * 100);
  };

  // منطق اللوحة (Canvas)
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    
    canvas.width = parent.clientWidth;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1e293b';
      ctxRef.current = ctx;
    }
  }, []);

  useEffect(() => {
    if (isCanvasOpen) {
      setTimeout(initCanvas, 100);
    }
  }, [isCanvasOpen, initCanvas]);

  const startDrawing = (e: any) => {
    isDrawingRef.current = true;
    const pos = getPos(e);
    lastPointRef.current = pos;
  };

  const draw = (e: any) => {
    if (!isDrawingRef.current || !ctxRef.current || !lastPointRef.current) return;
    const pos = getPos(e);
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctxRef.current.lineTo(pos.x, pos.y);
    ctxRef.current.stroke();
    lastPointRef.current = pos;
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
  };

  const getPos = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const clearCanvas = () => {
    if (ctxRef.current && canvasRef.current) {
      ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const convertHandwriting = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setLoadingAI(true);
    try {
      const base64 = canvas.toDataURL('image/png').split(',')[1];
      const text = await analyzeSolutionImage(base64, currentQuestion.text);
      if (text) {
        updateAnswer(userAnswers[currentIndex] + (userAnswers[currentIndex] ? "\n" : "") + text);
        setIsCanvasOpen(false);
      }
    } catch (err) {
      alert("حدث خطأ في الاتصال بالذكاء الاصطناعي.");
    } finally {
      setLoadingAI(false);
    }
  };

  const checkSolution = async () => {
    const answer = userAnswers[currentIndex];
    if (!answer.trim()) {
      alert("الرجاء كتابة الحل أولاً");
      return;
    }
    setLoadingAI(true);
    try {
      const result = await diagnoseSolutionText(answer, currentQuestion);
      if (result) {
        setDiagnosis(result);
        const allCorrect = result.every((step: DiagnosisResult) => step.isResCorrect);
        if (allCorrect) {
          const newStatus = [...solvedStatus];
          newStatus[currentIndex] = true;
          setSolvedStatus(newStatus);
        }
      }
    } catch (err) {
      alert("فشل تحليل الإجابة.");
    } finally {
      setLoadingAI(false);
    }
  };

  const insertSymbol = (sym: string) => {
    const val = sym === '──────────' ? '\n──────────\n' : sym;
    updateAnswer(userAnswers[currentIndex] + val);
  };

  const loadQuestionsFromJSON = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (Array.isArray(parsed)) {
        setQuestions(parsed);
        setSolvedStatus(new Array(parsed.length).fill(false));
        setUserAnswers(new Array(parsed.length).fill(""));
        setShowAddModal(false);
        alert("تم تحميل بنك الأسئلة بنجاح");
      }
    } catch (e) {
      alert("تنسيق JSON غير صحيح");
    }
  };

  const progressPercent = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen flex flex-col items-center bg-slate-50 transition-all duration-300 overflow-x-hidden">
      {/* شريط التقدم العلوي */}
      {view !== ViewState.START && (
        <div className="fixed top-0 left-0 w-full h-2 bg-slate-200 z-[60]">
          <div 
            className="h-full bg-blue-600 transition-all duration-700 shadow-[0_0_15px_rgba(37,99,235,0.6)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* الشاشة الرئيسية */}
      {view === ViewState.START && (
        <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 space-y-12 animate-in fade-in duration-1000 bg-slate-900 w-full relative">
          <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
             <div className="absolute -top-20 -left-20 w-96 h-96 bg-blue-500 rounded-full blur-3xl"></div>
             <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-indigo-500 rounded-full blur-3xl"></div>
          </div>

          <div className="space-y-6 z-10">
            <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter drop-shadow-2xl">
              منصة <span className="text-blue-500">يوسف</span>
            </h1>
            <p className="text-xl md:text-3xl text-slate-400 font-light max-w-2xl mx-auto">
              مستقبلك في الفيزياء يبدأ هنا مع أدوات الذكاء الاصطناعي الأكثر تطوراً في العراق.
            </p>
          </div>

          <div className="flex flex-col gap-5 w-full max-w-md z-10">
            <button 
              onClick={startExam}
              className="group flex items-center justify-center gap-4 py-5 px-8 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-all transform hover:scale-105 shadow-2xl shadow-blue-500/30 font-bold text-xl"
            >
              <PlayCircle size={28} className="group-hover:rotate-12 transition-transform" />
              ابدأ الاختبار الآن
            </button>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setShowAddModal(true)}
                className="flex items-center justify-center gap-2 py-4 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl transition-all border border-slate-700 font-bold text-sm"
              >
                <FileCode size={18} />
                بنك الأسئلة
              </button>
              <button 
                onClick={() => setShowContactModal(true)}
                className="flex items-center justify-center gap-2 py-4 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl transition-all border border-slate-700 font-bold text-sm"
              >
                <PhoneCall size={18} />
                تواصل معنا
              </button>
            </div>
          </div>
          
          <div className="mt-12 text-slate-500 text-sm font-medium z-10 flex items-center gap-2">
             <Info size={16} />
             جميع الحقوق محفوظة لمنصة يوسف © 2025
          </div>
        </div>
      )}

      {/* واجهة الاختبار */}
      {view === ViewState.EXAM && (
        <div className="w-full max-w-5xl p-4 md:p-8 mt-6 animate-in slide-in-from-bottom-10 duration-700 pb-40">
          
          {/* رأس السؤال */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setView(ViewState.START)}
                className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm group"
                title="الرجوع للرئيسية"
              >
                <Home size={22} className="group-hover:scale-110 transition-transform" />
              </button>
              <div className="bg-blue-600 text-white px-5 py-2 rounded-2xl text-lg font-black shadow-lg shadow-blue-200">
                س {currentIndex + 1}
              </div>
              <span className="text-slate-500 font-bold hidden sm:inline">من {questions.length}</span>
            </div>
            <button 
              onClick={() => setShowMap(true)}
              className="flex items-center gap-2 bg-white border border-slate-200 px-5 py-2.5 rounded-2xl hover:bg-slate-50 transition-all font-bold shadow-sm"
            >
              <LayoutGrid size={20} className="text-blue-500" />
              خريطة الأسئلة
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* جهة السؤال */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full opacity-50"></div>
                <h2 className="text-2xl font-bold text-slate-800 leading-relaxed mb-6 relative z-10">
                  {currentQuestion.text}
                </h2>
                
                {currentQuestion.image && (
                  <div className="my-6 bg-slate-50 p-4 rounded-3xl border-2 border-dashed border-slate-200 flex justify-center group overflow-hidden">
                    <img src={currentQuestion.image} alt="Diagram" className="max-h-64 object-contain rounded-xl shadow-lg transition-transform group-hover:scale-105" />
                  </div>
                )}

                <div className="bg-blue-50/80 border-r-4 border-blue-600 p-5 rounded-2xl space-y-3">
                  <h3 className="font-black text-blue-900 flex items-center gap-2">
                    <CheckCircle size={18} />
                    المطلوب حسابه:
                  </h3>
                  <ul className="space-y-2 text-slate-700 font-medium">
                    {currentQuestion.req.map((r, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-blue-500">●</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* شريط الرموز */}
              <div className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-100">
                <div className="flex gap-3 mb-4">
                  <button 
                    onClick={() => setActiveSymbolTab('curriculum')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeSymbolTab === 'curriculum' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    رموز الفيزياء
                  </button>
                  <button 
                    onClick={() => setActiveSymbolTab('math')}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeSymbolTab === 'math' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    رموز الرياضيات
                  </button>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {SYMBOLS[activeSymbolTab].map((sym, idx) => (
                    <button 
                      key={idx}
                      onClick={() => insertSymbol(sym)}
                      className="bg-slate-50 aspect-square flex items-center justify-center rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition-all font-bold text-lg active:scale-90"
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* جهة الحل */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col min-h-[500px] relative">
                {/* أدوات التحكم بالحل */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 backdrop-blur-md z-30">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setIsCanvasOpen(!isCanvasOpen)}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-bold ${isCanvasOpen ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-white text-slate-700 border border-slate-200 shadow-sm'}`}
                    >
                      <PenTool size={20} />
                      <span className="hidden sm:inline">خط اليد</span>
                    </button>
                    <button 
                      onClick={toggleListening}
                      className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-600 text-white shadow-lg shadow-blue-200'}`}
                    >
                      {isListening ? <MicOff size={22} /> : <Mic size={22} />}
                    </button>
                  </div>
                  <button 
                    onClick={() => updateAnswer("")}
                    className="text-red-500 p-2 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                {/* منطقة النص */}
                <div className="relative flex-1 flex flex-col">
                  <textarea 
                    value={userAnswers[currentIndex]}
                    onChange={(e) => updateAnswer(e.target.value)}
                    placeholder="اكتب خطوات الحل بالتفصيل هنا..."
                    className="flex-1 w-full p-8 text-xl leading-[1.8] resize-none focus:outline-none bg-transparent font-mono placeholder:text-slate-300"
                  />

                  {/* لوحة الرسم المنبثقة */}
                  {isCanvasOpen && (
                    <div className="absolute inset-0 z-40 bg-white flex flex-col animate-in fade-in zoom-in duration-300">
                      <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                        <div className="flex gap-3">
                          <button onClick={() => { if(ctxRef.current) ctxRef.current.globalCompositeOperation = 'source-over'; }} className="p-3 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all"><PenTool size={20}/></button>
                          <button onClick={() => { if(ctxRef.current) ctxRef.current.globalCompositeOperation = 'destination-out'; }} className="p-3 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all"><Eraser size={20}/></button>
                          <button onClick={clearCanvas} className="p-3 bg-white border border-slate-200 rounded-xl hover:shadow-md text-red-500 transition-all"><Trash2 size={20}/></button>
                        </div>
                        <div className="flex gap-3">
                          <button 
                            onClick={convertHandwriting} 
                            disabled={loadingAI}
                            className="bg-orange-500 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-600 transition-all shadow-lg shadow-orange-200 disabled:opacity-50"
                          >
                            <Cpu size={20} />
                            تحويل بالذكاء
                          </button>
                          <button onClick={() => setIsCanvasOpen(false)} className="bg-slate-200 text-slate-600 p-2 rounded-xl"><X size={24}/></button>
                        </div>
                      </div>
                      <canvas 
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="flex-1 canvas-dots cursor-crosshair touch-none"
                      />
                      {loadingAI && (
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white z-50">
                          <div className="w-16 h-16 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mb-6"></div>
                          <p className="text-2xl font-black">جاري تحليل خط اليد...</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* نتائج التصحيح */}
              <div className="space-y-4">
                <button 
                  onClick={checkSolution}
                  disabled={loadingAI}
                  className={`w-full py-5 rounded-3xl text-white font-black text-xl flex items-center justify-center gap-4 shadow-2xl transition-all transform active:scale-95 ${loadingAI ? 'bg-slate-400 cursor-wait' : 'bg-green-600 hover:bg-green-500 shadow-green-200'}`}
                >
                  {loadingAI ? (
                    <><div className="w-7 h-7 border-4 border-white border-t-transparent rounded-full animate-spin"></div> جاري التحقق...</>
                  ) : (
                    <><CheckCircle size={28}/> تصحيح الحل الآن</>
                  )}
                </button>

                {diagnosis && (
                  <div className="grid grid-cols-1 gap-4 animate-in slide-in-from-top-4 duration-500">
                    {diagnosis.map((step, idx) => (
                      <div key={idx} className={`p-6 rounded-[2rem] border-r-8 shadow-xl bg-white transition-all transform hover:-translate-x-1 ${step.isResCorrect ? 'border-green-500' : 'border-red-500'}`}>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xl font-black text-slate-800">{step.title}</span>
                          <span className={`px-4 py-1.5 rounded-full text-sm font-black ${step.isResCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {step.isResCorrect ? 'إجابة صحيحة' : 'تحتاج مراجعة'}
                          </span>
                        </div>
                        <div className="flex gap-4 mb-3 text-sm font-bold">
                           <span className={step.isLawFound ? 'text-green-600' : 'text-slate-400'}>القانون {step.isLawFound ? '✅' : '❓'}</span>
                           <span className={step.isSubCorrect ? 'text-green-600' : 'text-slate-400'}>التعويض {step.isSubCorrect ? '✅' : '❌'}</span>
                           <span className={step.isResCorrect ? 'text-green-600' : 'text-slate-400'}>الناتج {step.isResCorrect ? '✅' : '❌'}</span>
                        </div>
                        <p className="text-slate-600 text-lg leading-relaxed">{step.feedback}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* أزرار التنقل */}
              <div className="flex gap-4 pt-8">
                <button 
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="flex-1 py-4 px-8 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black disabled:opacity-30 flex items-center justify-center gap-3 hover:bg-slate-50 transition-all shadow-sm"
                >
                  <ChevronRight size={24} />
                  السابق
                </button>
                <button 
                  onClick={handleNext}
                  className="flex-[2] py-4 px-8 rounded-2xl bg-blue-600 text-white font-black text-xl flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-xl shadow-blue-200"
                >
                  {currentIndex === questions.length - 1 ? 'إنهاء الاختبار' : 'السؤال التالي'}
                  <ChevronLeft size={24} />
                </button>
              </div>

              <div className="flex flex-col items-center gap-4">
                <button 
                  onClick={() => setShowTargets(!showTargets)}
                  className="text-slate-400 hover:text-slate-600 flex items-center gap-2 font-bold transition-all"
                >
                  {showTargets ? <EyeOff size={18}/> : <Eye size={18}/>}
                  {showTargets ? 'إخفاء الأجوبة النموذجية' : 'إظهار الأجوبة النموذجية'}
                </button>
                {showTargets && (
                  <div className="w-full bg-slate-800 text-blue-400 p-6 rounded-2xl text-center font-mono text-xl animate-in fade-in slide-in-from-top-2 border border-slate-700">
                    {currentQuestion.targets}
                  </div>
                )}
                
                {/* زر رجوع إضافي في الأسفل */}
                <button 
                  onClick={() => setView(ViewState.START)}
                  className="mt-4 flex items-center gap-2 text-slate-400 hover:text-blue-500 font-bold transition-all px-4 py-2"
                >
                  <Home size={18} />
                  الرجوع للرئيسية
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* شاشة النتيجة */}
      {view === ViewState.RESULT && (
        <div className="flex flex-col items-center justify-center min-h-screen w-full p-6 animate-in zoom-in duration-700 bg-slate-50">
          <div className="bg-white rounded-[3rem] p-12 shadow-[0_30px_100px_rgba(0,0,0,0.1)] max-w-xl w-full text-center border border-slate-100 relative overflow-hidden">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-50 rounded-full opacity-50"></div>
            
            <div className="relative z-10">
              <Award size={100} className="text-blue-500 mx-auto mb-8 drop-shadow-xl" />
              <h2 className="text-4xl font-black text-slate-800 mb-4">انتهى الاختبار بنجاح!</h2>
              
              <div className="my-10 relative inline-block">
                <div className="w-48 h-48 rounded-full border-[16px] border-slate-50 flex items-center justify-center shadow-inner">
                  <span className="text-6xl font-black text-blue-600">{calculateFinalScore()}%</span>
                </div>
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-1.5 rounded-full font-black text-sm shadow-lg">
                  المعدل النهائي
                </div>
              </div>

              <p className="text-2xl text-slate-500 mb-10 leading-relaxed font-medium">
                تمكنت من حل <b>{solvedStatus.filter(Boolean).length}</b> مسألة من أصل <b>{questions.length}</b> بدقة عالية.
              </p>

              <div className="flex flex-col gap-4">
                <button 
                  onClick={startExam}
                  className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-xl hover:bg-blue-500 transition-all shadow-2xl shadow-blue-100 active:scale-95"
                >
                  بدء اختبار جديد
                </button>
                <button 
                  onClick={() => setView(ViewState.START)}
                  className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-xl hover:bg-slate-800 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
                >
                  <Home size={24} />
                  الرجوع للرئيسية
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* القوائم المنبثقة (Modals) */}
      {showMap && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 animate-in zoom-in duration-300 shadow-2xl">
            <h3 className="text-2xl font-black mb-8 flex items-center gap-3">
              <LayoutGrid size={32} className="text-blue-500" />
              خارطة الأسئلة
            </h3>
            <div className="grid grid-cols-4 gap-4">
              {questions.map((q, idx) => (
                <button 
                  key={idx}
                  onClick={() => { setCurrentIndex(idx); setShowMap(false); setDiagnosis(null); }}
                  className={`aspect-square rounded-2xl font-black text-2xl transition-all transform hover:scale-105 active:scale-90 ${idx === currentIndex ? 'bg-blue-600 text-white ring-8 ring-blue-100 shadow-lg shadow-blue-200' : solvedStatus[idx] ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setShowMap(false)}
              className="w-full mt-10 py-4 bg-slate-100 rounded-2xl font-black text-slate-500 hover:bg-slate-200 transition-all"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] p-10 flex flex-col gap-6 animate-in slide-in-from-bottom duration-500 shadow-2xl">
            <div className="flex items-center gap-4">
               <FileCode size={40} className="text-green-600" />
               <h3 className="text-2xl font-black">تغذية بنك الأسئلة الذكي</h3>
            </div>
            <p className="text-slate-500 font-medium">أدخل الأسئلة بصيغة JSON لتحديث المنهج الدراسي فوراً.</p>
            <textarea 
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='[ { "text": "...", "req": [...], "targets": "..." } ]'
              className="w-full h-64 bg-slate-50 p-6 rounded-2xl border border-slate-200 font-mono text-sm focus:outline-none focus:ring-4 focus:ring-green-500/10 placeholder:text-slate-300"
            />
            <div className="flex gap-4">
              <button 
                onClick={loadQuestionsFromJSON}
                className="flex-[2] py-5 bg-green-600 text-white rounded-2xl font-black text-lg shadow-2xl shadow-green-200 hover:bg-green-500 transition-all active:scale-95"
              >
                تحديث البيانات
              </button>
              <button 
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-lg hover:bg-slate-200 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {showContactModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 flex flex-col gap-8 animate-in zoom-in duration-300 text-center shadow-2xl">
            <div className="bg-blue-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <PhoneCall size={48} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-800">تواصل معنا</h3>
              <p className="text-slate-500 mt-2 font-medium italic">للإبلاغ عن مشاكل تقنية أو استفسارات</p>
            </div>
            
            <div className="space-y-4">
              <a href="tel:07840050111" className="flex items-center justify-center gap-4 w-full py-5 bg-green-500 text-white rounded-[1.5rem] font-black text-xl hover:bg-green-400 transition-all shadow-xl shadow-green-100">
                <PhoneCall size={24}/>
                07840050111
              </a>
              <a href="https://www.instagram.com/yousefiq90" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-4 w-full py-5 insta-gradient text-white rounded-[1.5rem] font-black text-xl hover:opacity-90 transition-all shadow-xl shadow-red-100">
                <i className="fab fa-instagram text-2xl"></i>
                Yousef IQ
              </a>
            </div>

            <button 
              onClick={() => setShowContactModal(false)}
              className="py-2 text-slate-400 font-bold hover:text-slate-600 transition-all"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
