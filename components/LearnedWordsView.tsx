import React, { useState, useMemo } from 'react';
import { UserData, WordMasteryInfo, WordLevel } from '../types';
import { WORD_LISTS } from '../constants';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { DocumentArrowDownIcon } from './icons/DocumentArrowDownIcon';
import { PencilIcon } from './icons/PencilIcon';
import Spinner from './Spinner';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { TrashIcon } from './icons/TrashIcon';

// Declare global variables for libraries loaded via script tags
declare const html2canvas: any;
declare const jspdf: any;

interface LearnedWordsViewProps {
    userName: string;
    userData: UserData;
    onBack: () => void;
    onDeleteUserData?: (userName: string) => void;
    onPracticeWeakWords?: (words: string[]) => void;
}

type FilterType = 'all' | 'known' | 'practice';

const capitalizeFirstLetter = (string: string): string => {
    if (!string) return string;
    return string.charAt(0).toUpperCase() + string.slice(1);
};

// Emoji's voor verschillende onderwerpcategorieën
const SUBJECT_EMOJIS: Record<string, string> = {
    [WordLevel.Woordenschat2DF]: '📚',
    [WordLevel.Woordenschat2AF]: '🛠️',
    [WordLevel.AcademischNederlands]: '🎓',
    [WordLevel.ProfessioneelNederlands]: '💼',
    [WordLevel.Custom]: '✏️',
    'default': '📖',
};

const SubjectIcon: React.FC<{ subject: string }> = ({ subject }) => {
    // Find a matching key, even if the subject name is slightly different
    const emojiKey = Object.keys(SUBJECT_EMOJIS).find(key => subject.toLowerCase().includes(key.toLowerCase())) || 'default';
    const emoji = SUBJECT_EMOJIS[emojiKey];
    return <span className="text-2xl" role="img" aria-label={subject}>{emoji}</span>;
};


const PrintTable: React.FC<{ words: [string, WordMasteryInfo][]; userName: string; subject: string; }> = ({ words, userName, subject }) => (
    <div className="bg-white rounded-xl">
        <div className="my-8 text-black">
            <h1 className="text-2xl font-bold">Woordenlijst voor <span className="capitalize">{userName}</span></h1>
            <p className="text-lg font-semibold text-slate-700">Onderwerp: {subject}</p>
            <p className="text-sm text-slate-600">Gegenereerd door TALtrekkers Woordenschat Trainer op {new Date().toLocaleDateString('nl-NL')}</p>
        </div>
        <div className="p-4 border-b-2 border-slate-200">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-1 font-bold text-slate-600">Woord</div>
                <div className="col-span-1 font-bold text-slate-600">Definitie</div>
            </div>
        </div>
        <div className="divide-y divide-slate-100 text-black">
            {words.length > 0 ? (
                words.map(([word, info]) => (
                    <div key={word} className="p-4 grid grid-cols-2 gap-x-4 break-words break-inside-avoid-page">
                        <div className="col-span-1 font-semibold text-slate-800">{capitalizeFirstLetter(word)}</div>
                        <p className="col-span-1 text-slate-600 text-sm">{info.definitie}</p>
                    </div>
                ))
            ) : (
                <div className="text-center p-12"><p className="text-slate-500">Geen woorden gevonden.</p></div>
            )}
        </div>
    </div>
);


const SubjectWordsGroup: React.FC<{
    subject: string;
    words: Record<string, WordMasteryInfo>;
    userName: string;
    isExpanded: boolean;
    onToggle: () => void;
    totalWordsInFullList?: number; // Total words in the complete word list
}> = ({ subject, words, userName, isExpanded, onToggle, totalWordsInFullList }) => {
    const [filter, setFilter] = useState<FilterType>('all');
    const [isDownloading, setIsDownloading] = useState(false);

    const filteredWordEntries = useMemo(() => {
        // FIX: Explicitly type allWords to ensure correct type inference for 'info' in the filter methods.
        const allWords: [string, WordMasteryInfo][] = Object.entries(words);
        if (filter === 'known') {
            return allWords.filter(([, info]) => info.incorrect === 0 && info.correct > 0)
                .sort(([wordA], [wordB]) => wordA.localeCompare(wordB));
        }
        if (filter === 'practice') {
            return allWords.filter(([, info]) => info.incorrect > 0)
                .sort(([wordA], [wordB]) => wordA.localeCompare(wordB));
        }
        return allWords.sort(([wordA], [wordB]) => wordA.localeCompare(wordB));
    }, [words, filter]);

    const getFilterCounts = useMemo(() => {
        // FIX: Explicitly type wordInfos to ensure correct type inference for 'info' in the filter methods.
        const wordInfos: WordMasteryInfo[] = Object.values(words);
        return {
            all: Object.keys(words).length,
            known: wordInfos.filter(info => info.incorrect === 0 && info.correct > 0).length,
            practice: wordInfos.filter(info => info.incorrect > 0).length,
            total: totalWordsInFullList || Object.keys(words).length, // Total from full list or fallback to practiced
        };
    }, [words, totalWordsInFullList]);

    const handleDownloadPdf = async () => {
        const printableElementId = `print-table-${subject.replace(/\s/g, '-')}`;

        setIsDownloading(true);
        // Temporarily render the printable table
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '0';
        tempContainer.innerHTML = `<div id="${printableElementId}" class="p-4 bg-white w-[800px]"></div>`;
        document.body.appendChild(tempContainer);

        const reactRoot = (await import('react-dom/client')).createRoot(document.getElementById(printableElementId)!);
        reactRoot.render(<PrintTable words={filteredWordEntries} userName={userName} subject={subject} />);

        // Allow a moment for rendering
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            const element = document.getElementById(printableElementId) as HTMLElement;
            if (!element) throw new Error("Printable element not found");

            const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false });
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = jspdf;
            const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

            const pdfPageWidth = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * pdfPageWidth) / imgProps.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfPageWidth, imgHeight);
            pdf.save(`woordenlijst-${userName.toLowerCase()}-${subject.toLowerCase()}.pdf`);
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            alert("Er is een fout opgetreden bij het genereren van de PDF.");
        } finally {
            reactRoot.unmount();
            document.body.removeChild(tempContainer);
            setIsDownloading(false);
        }
    };

    const handleDownloadWorksheet = async () => {
        if (filteredWordEntries.length === 0) {
            alert("Er zijn geen woorden in deze selectie om een werkblad van te maken.");
            return;
        }
        setIsDownloading(true);
        try {
            const { jsPDF } = jspdf;
            const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 40;
            const usableWidth = pageWidth - margin * 2;

            const drawFrayerModel = (word: string, info: WordMasteryInfo, startY: number) => {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(20);
                doc.text(capitalizeFirstLetter(word), margin, startY);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                const definitionLines = doc.splitTextToSize(info.definitie, usableWidth);
                doc.text(definitionLines, margin, startY + 25);

                const definitionHeight = (doc.getTextDimensions(definitionLines).h);
                const gridStartY = startY + 25 + definitionHeight + 10;
                const gridHeight = 220;
                const rowHeight = gridHeight / 2;
                const colWidth = usableWidth / 2;

                doc.setDrawColor(203, 213, 225);
                doc.setLineWidth(1);
                doc.rect(margin, gridStartY, usableWidth, gridHeight);
                doc.line(margin, gridStartY + rowHeight, margin + usableWidth, gridStartY + rowHeight);
                doc.line(margin + colWidth, gridStartY, margin + colWidth, gridStartY + gridHeight);

                doc.setFontSize(9);
                doc.setTextColor(71, 85, 105);
                doc.text('Definitie / Kenmerken', margin + 5, gridStartY + 12);
                doc.text('Voorbeelden', margin + colWidth + 5, gridStartY + 12);
                doc.text('Niet-voorbeelden / Antoniemen', margin + 5, gridStartY + rowHeight + 12);
                doc.text('Synoniemen / Associaties', margin + colWidth + 5, gridStartY + rowHeight + 12);
                doc.setTextColor(0, 0, 0);
            };

            let y = margin;
            doc.setFont('helvetica', 'bold'); doc.setFontSize(24);
            doc.text(`Werkblad voor ${capitalizeFirstLetter(userName)}`, margin, y);
            y += 30;
            doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(71, 85, 105);
            doc.text(`Onderwerp: ${subject}`, margin, y); y += 40;

            const pageHeight = doc.internal.pageSize.getHeight();
            const frayerModelHeight = 350;

            let currentY = y;
            for (const [word, info] of filteredWordEntries) {
                if (currentY + frayerModelHeight > pageHeight - margin) {
                    doc.addPage();
                    currentY = margin;
                }
                drawFrayerModel(word, info, currentY);
                currentY += frayerModelHeight;
            }

            doc.save(`werkblad-${userName.toLowerCase()}-${subject.toLowerCase()}.pdf`);
        } catch (e) {
            console.error("Fout bij genereren werkblad:", e);
            alert("Er is een fout opgetreden bij het genereren van het werkblad.");
        } finally {
            setIsDownloading(false);
        }
    };


    return (
        <div className="bg-white rounded-xl shadow-sm transition-shadow hover:shadow-md">
            <div className="p-4 flex items-center cursor-pointer" onClick={onToggle}>
                <div className="flex items-center gap-4 flex-grow">
                    <SubjectIcon subject={subject} />
                    <div className="flex-grow">
                        <h3 className="font-bold text-slate-800">{subject}</h3>
                        <div className="flex items-center gap-3 text-sm text-slate-500 flex-wrap">
                            {/* Show progress relative to total word list */}
                            <span title="Woorden die je hebt geoefend">
                                📚 {getFilterCounts.all}/{getFilterCounts.total} geoefend
                            </span>
                            <span className="text-slate-300 hidden sm:inline">•</span>
                            <span className="text-green-600" title="Gekend (geen fouten)">
                                ✅ {getFilterCounts.known}/{getFilterCounts.total}
                            </span>
                            <span className="text-yellow-600" title="Te oefenen (met fouten)">
                                📝 {getFilterCounts.practice}
                            </span>
                        </div>
                        {/* Progress bar - shows practiced/total */}
                        {getFilterCounts.total > 0 && (
                            <div className="mt-1 h-2 bg-slate-200 rounded-full overflow-hidden max-w-xs relative">
                                {/* Background: practiced portion */}
                                <div
                                    className="absolute h-full bg-blue-300 transition-all duration-300"
                                    style={{ width: `${Math.round((getFilterCounts.all / getFilterCounts.total) * 100)}%` }}
                                    title={`${Math.round((getFilterCounts.all / getFilterCounts.total) * 100)}% geoefend`}
                                />
                                {/* Foreground: known portion */}
                                <div
                                    className="absolute h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-300"
                                    style={{ width: `${Math.round((getFilterCounts.known / getFilterCounts.total) * 100)}%` }}
                                    title={`${Math.round((getFilterCounts.known / getFilterCounts.total) * 100)}% gekend`}
                                />
                            </div>
                        )}
                    </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); handleDownloadPdf(); }} disabled={isDownloading} className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white text-slate-600 text-xs font-semibold rounded-lg shadow-sm hover:bg-slate-50 border border-slate-200 transition-all disabled:opacity-50">
                        {isDownloading ? <Spinner className="text-slate-600 h-4 w-4" /> : <DocumentArrowDownIcon className="h-4 w-4" />} PDF
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDownloadWorksheet(); }} disabled={isDownloading} className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white text-slate-600 text-xs font-semibold rounded-lg shadow-sm hover:bg-slate-50 border border-slate-200 transition-all disabled:opacity-50">
                        {isDownloading ? <Spinner className="text-slate-600 h-4 w-4" /> : <PencilIcon className="h-4 w-4" />} Werkblad
                    </button>
                    <div className="p-1 rounded-full hover:bg-slate-100">
                        <ChevronDownIcon className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                </div>
            </div>
            {isExpanded && (
                <div className="bg-slate-50/70 border-t border-slate-200 p-4 animate-fade-in">
                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
                        <div className="flex justify-center gap-2 flex-grow">
                            <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded-lg font-semibold transition-colors text-xs ${filter === 'all' ? 'bg-tal-teal text-white shadow' : 'bg-white hover:bg-slate-100 text-slate-700'}`}>Alles ({getFilterCounts.all})</button>
                            <button onClick={() => setFilter('known')} className={`px-3 py-1 rounded-lg font-semibold transition-colors text-xs ${filter === 'known' ? 'bg-green-600 text-white shadow' : 'bg-white hover:bg-slate-100 text-slate-700'}`}>Gekend ({getFilterCounts.known})</button>
                            <button onClick={() => setFilter('practice')} className={`px-3 py-1 rounded-lg font-semibold transition-colors text-xs ${filter === 'practice' ? 'bg-yellow-500 text-yellow-900 shadow' : 'bg-white hover:bg-slate-100 text-slate-700'}`}>Te oefenen ({getFilterCounts.practice})</button>
                        </div>
                        <div className="flex sm:hidden justify-center gap-2 mt-2">
                            <button onClick={handleDownloadPdf} disabled={isDownloading} className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-600 text-xs font-semibold rounded-lg shadow-sm hover:bg-slate-50 border border-slate-200 transition-all disabled:opacity-50">
                                {isDownloading ? <Spinner className="text-slate-600 h-4 w-4" /> : <DocumentArrowDownIcon className="h-4 w-4" />} PDF
                            </button>
                            <button onClick={handleDownloadWorksheet} disabled={isDownloading} className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-600 text-xs font-semibold rounded-lg shadow-sm hover:bg-slate-50 border border-slate-200 transition-all disabled:opacity-50">
                                {isDownloading ? <Spinner className="text-slate-600 h-4 w-4" /> : <PencilIcon className="h-4 w-4" />} Werkblad
                            </button>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-200">
                        {filteredWordEntries.length > 0 ? (
                            filteredWordEntries.map(([word, info]) => (
                                <div key={word} className="py-2 grid grid-cols-1 sm:grid-cols-5 gap-x-4 gap-y-1 break-words items-center">
                                    <div className="col-span-2 font-semibold text-slate-800">{capitalizeFirstLetter(word)}</div>
                                    <p className="col-span-full sm:col-span-2 text-slate-600 text-sm">{info.definitie}</p>
                                    <div className="col-span-full sm:col-span-1 text-left sm:text-right text-sm">
                                        <span className="font-semibold text-green-600">{info.correct}</span>
                                        <span className="text-slate-400 mx-1">/</span>
                                        <span className="font-semibold text-red-600">{info.incorrect}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center p-8"><p className="text-slate-500">Geen woorden gevonden voor dit filter.</p></div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};


const DeleteConfirmPrompt: React.FC<{
    onConfirm: () => void;
    onCancel: () => void;
    userName: string;
}> = ({ onConfirm, onCancel, userName }) => {
    const [confirmText, setConfirmText] = React.useState('');
    const isValid = confirmText.toLowerCase() === 'verwijder';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isValid) {
            onConfirm();
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" style={{ animationDuration: '150ms' }}>
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm text-left">
                <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">⚠️</span>
                    <h3 className="text-lg font-bold text-slate-800">Gegevens verwijderen</h3>
                </div>
                <p className="text-sm text-slate-600 mb-4">
                    Weet je zeker dat je alle gegevens van <strong className="text-slate-800">"{userName}"</strong> wilt verwijderen?
                    Dit omvat alle sessiegeschiedenis, geleerde woorden en XP-punten.
                </p>
                <p className="text-sm text-red-600 font-medium mb-4">
                    ⚠️ Deze actie kan niet ongedaan worden gemaakt!
                </p>
                <form onSubmit={handleSubmit}>
                    <label htmlFor="confirm-delete" className="text-sm font-medium text-slate-700">
                        Typ <strong className="text-red-600">verwijder</strong> om te bevestigen:
                    </label>
                    <input
                        id="confirm-delete"
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="verwijder"
                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-red-500 mt-1"
                        autoFocus
                        autoComplete="off"
                    />
                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 transition-colors">
                            Annuleren
                        </button>
                        <button
                            type="submit"
                            disabled={!isValid}
                            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                        >
                            🗑️ Verwijderen
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const LearnedWordsView: React.FC<LearnedWordsViewProps> = ({ userName, userData, onBack, onDeleteUserData, onPracticeWeakWords }) => {
    const [showDeletePrompt, setShowDeletePrompt] = useState(false);

    // Calculate weak words (words with at least one incorrect answer)
    const weakWords = useMemo(() => {
        const learnedWords = userData.learnedWords || {};
        return Object.entries(learnedWords)
            .filter(([, info]) => info.incorrect > 0)
            .map(([word]) => word);
    }, [userData.learnedWords]);

    const wordsBySubject = useMemo(() => {
        const bySubject: Record<string, Record<string, WordMasteryInfo>> = {};
        const allLearnedWords = userData.learnedWords || {};

        userData.sessionHistory.forEach(session => {
            const subject = session.settings.courseId ? session.settings.richting! : (session.settings.context || WordLevel.Custom);
            if (!bySubject[subject]) {
                bySubject[subject] = {};
            }
            session.words.forEach(word => {
                const wordKey = word.toLowerCase();
                if (allLearnedWords[wordKey]) {
                    bySubject[subject][wordKey] = allLearnedWords[wordKey];
                }
            });
        });

        return bySubject;
    }, [userData]);

    const subjects = useMemo(() => Object.keys(wordsBySubject).sort(), [wordsBySubject]);
    const [expandedSubject, setExpandedSubject] = useState<string | null>(subjects.length > 0 ? subjects[0] : null);

    const handleDeleteConfirm = () => {
        if (onDeleteUserData) {
            onDeleteUserData(userName);
        }
        setShowDeletePrompt(false);
        onBack(); // Go back after deletion
    };

    const toggleSubject = (subject: string) => {
        setExpandedSubject(prev => (prev === subject ? null : subject));
    };

    // Helper to get total words in a full word list (for predefined lists)
    const getTotalWordsForSubject = (subject: string): number | undefined => {
        // Check if subject matches a WordLevel enum value (predefined lists)
        const wordLevelValues = Object.values(WordLevel);
        if (wordLevelValues.includes(subject as WordLevel)) {
            return WORD_LISTS[subject]?.length;
        }
        return undefined; // Custom lists don't have a predefined total
    };

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-3xl font-bold text-slate-800 text-center sm:text-left">
                    Woordenlijst: <span className="text-tal-teal capitalize">{userName}</span>
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Practice weak words button */}
                    {onPracticeWeakWords && weakWords.length > 0 && (
                        <button
                            onClick={() => onPracticeWeakWords(weakWords)}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-800 font-semibold rounded-lg shadow-sm hover:bg-amber-200 transition-all border border-amber-300"
                            title={`Oefen ${weakWords.length} woorden waar je fouten in hebt gemaakt`}
                        >
                            🔄 Oefen zwakke woorden ({weakWords.length})
                        </button>
                    )}
                    {onDeleteUserData && (
                        <button
                            onClick={() => setShowDeletePrompt(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 font-semibold rounded-lg shadow-sm hover:bg-red-200 transition-all"
                            title="Verwijder al mijn gegevens"
                        >
                            <TrashIcon className="h-5 w-5" />
                            <span className="hidden sm:inline">Verwijder mijn gegevens</span>
                        </button>
                    )}
                    <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 bg-tal-purple text-white font-semibold rounded-lg shadow-md hover:bg-tal-purple-dark transition-all">
                        <ArrowLeftIcon className="h-5 w-5" />
                        Terug naar Dashboard
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {subjects.length > 0 ? (
                    subjects.map(subject => (
                        <SubjectWordsGroup
                            key={subject}
                            subject={subject}
                            words={wordsBySubject[subject]}
                            userName={userName}
                            isExpanded={expandedSubject === subject}
                            onToggle={() => toggleSubject(subject)}
                            totalWordsInFullList={getTotalWordsForSubject(subject)}
                        />
                    ))
                ) : (
                    <div className="text-center bg-white rounded-xl shadow-sm p-12">
                        <p className="text-slate-500">Deze leerling heeft nog geen woorden geleerd.</p>
                    </div>
                )}
            </div>

            {showDeletePrompt && (
                <DeleteConfirmPrompt
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setShowDeletePrompt(false)}
                    userName={userName}
                />
            )}
        </div>
    );
};

export default LearnedWordsView;