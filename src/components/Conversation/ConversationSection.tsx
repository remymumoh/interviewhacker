/**
 * ConversationSection - UI component for conversation recording and AI suggestions
 * Follows Single Responsibility Principle - only handles conversation UI
 * Uses existing ContentSection pattern for consistency
 * Integrates with screenshot system for cohesive experience
 */
import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AudioRecorder } from '../../utils/audioRecorder';
import { ConversationCommands } from './ConversationCommands';

interface ConversationMessage {
  id: string;
  speaker: 'interviewer' | 'interviewee' | 'ai';
  text: string;
  timestamp: number;
  edited?: boolean;
}

interface AISuggestion {
  suggestions: string[];
  reasoning: string;
}

// Reuse the same ContentSection style from Solutions.tsx for consistency
const ContentSection = ({
  title,
  content,
  isLoading
}: {
  title: string;
  content: React.ReactNode;
  isLoading: boolean;
}) => (
  <div className="space-y-2">
    <h2 className="text-[13px] font-medium text-white tracking-wide">
      {title}
    </h2>
    {isLoading ? (
      <div className="mt-4 flex">
        <p className="text-xs bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-clip-text text-transparent animate-pulse">
          Processing...
        </p>
      </div>
    ) : (
      <div className="text-[13px] leading-[1.4] text-gray-100 max-w-[600px]">
        {content}
      </div>
    )}
  </div>
);

interface ConversationSectionProps {
  // When true, only show the recording controls (no conversation history)
  controlsOnly?: boolean;
}

export const ConversationSection: React.FC<ConversationSectionProps> = ({ controlsOnly = false }) => {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<'interviewer' | 'interviewee'>('interviewee');
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [tooltipHeight, setTooltipHeight] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const processingCountRef = useRef(0);
  
  // Use refs to track state for event listener (avoids stale closures in useEffect)
  const isRecordingRef = useRef(false);
  const currentSpeakerRef = useRef<'interviewer' | 'interviewee'>(currentSpeaker);
  
  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setTooltipHeight(height);
  };
  
  const handleClearConversation = async () => {
    try {
      await window.electronAPI.clearConversation();
    } catch (error) {
      console.error('Failed to clear conversation:', error);
    }
  };
  
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    currentSpeakerRef.current = currentSpeaker;
  }, [currentSpeaker]);

  useEffect(() => {
    loadConversation();
    
    const unsubscribeMessageAdded = window.electronAPI.onConversationMessageAdded((message: ConversationMessage) => {
      setMessages(prev => [...prev, message]);
      scrollToBottom();
    });
    
    const unsubscribeSpeakerChanged = window.electronAPI.onSpeakerChanged((speaker: string) => {
      setCurrentSpeaker(speaker as 'interviewer' | 'interviewee');
      currentSpeakerRef.current = speaker as 'interviewer' | 'interviewee';
    });

    const unsubscribeMessageUpdated = window.electronAPI.onConversationMessageUpdated((message: ConversationMessage) => {
      setMessages(prev => prev.map(msg => msg.id === message.id ? message : msg));
    });

    const unsubscribeCleared = window.electronAPI.onConversationCleared(() => {
      setMessages([]);
      setAiSuggestions(null);
    });

    // Listen for keyboard shortcut to toggle recording
    const handleToggleRecording = async () => {
      // Check actual recording state using ref to get latest value
      const currentIsRecording = isRecordingRef.current || (audioRecorderRef.current?.getIsRecording() || false);
      if (currentIsRecording) {
        await handleStopRecording();
      } else {
        await handleStartRecording();
      }
    };

    window.addEventListener('toggle-recording', handleToggleRecording);

    // Listen for scroll events from keyboard shortcuts (Cmd+J / Cmd+K)
    const handleScrollUp = () => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop -= 100;
      }
    };
    const handleScrollDown = () => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop += 100;
      }
    };
    window.addEventListener('content-scroll-up', handleScrollUp);
    window.addEventListener('content-scroll-down', handleScrollDown);

    return () => {
      unsubscribeMessageAdded();
      unsubscribeSpeakerChanged();
      unsubscribeMessageUpdated();
      unsubscribeCleared();
      window.removeEventListener('toggle-recording', handleToggleRecording);
      window.removeEventListener('content-scroll-up', handleScrollUp);
      window.removeEventListener('content-scroll-down', handleScrollDown);
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversation = async () => {
    try {
      const result = await window.electronAPI.getConversation();
      if (result.success) {
        setMessages(result.messages);
        scrollToBottom();
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const handleStartRecording = async () => {
    try {
      // Check if already recording
      if (audioRecorderRef.current?.getIsRecording()) {
        console.log('Already recording');
        return;
      }
      
      if (!audioRecorderRef.current) {
        audioRecorderRef.current = new AudioRecorder();
      }
      
      await audioRecorderRef.current.startRecording();
      setIsRecording(true);
      isRecordingRef.current = true;
      setRecordingDuration(0);
      
      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      alert(error.message || 'Failed to start recording. Please check microphone permissions.');
    }
  };

  const handleStopRecording = async () => {
    console.log('[ConvDebug] handleStopRecording called, currentSpeakerRef:', currentSpeakerRef.current, 'currentSpeaker state:', currentSpeaker);
    // Check recorder state directly instead of React state to avoid stale closures
    if (!audioRecorderRef.current || !audioRecorderRef.current.getIsRecording()) {
      console.log('[ConvDebug] Not recording, cannot stop');
      return;
    }
    
    setIsRecording(false);
    isRecordingRef.current = false;
    
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    try {
      const audioBlob = await audioRecorderRef.current.stopRecording();
      const speakerAtStop = currentSpeakerRef.current;
      setRecordingDuration(0);

      // Process recording — speaker stays as-is, user toggles manually
      void processRecording(audioBlob, speakerAtStop);
    } catch (error: any) {
      console.error('Failed to stop recording:', error);
      alert(error.message || 'Failed to stop recording');
    }
  };

  const processRecording = async (audioBlob: Blob, speaker: 'interviewer' | 'interviewee') => {
    updateProcessingStatus(1);
    console.log('[ConvDebug] processRecording called, speaker:', speaker, 'blob size:', audioBlob.size);
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();

      console.log('[ConvDebug] Calling transcribeAudio...');
      const transcribeResult = await window.electronAPI.transcribeAudio(arrayBuffer, audioBlob.type);
      console.log('[ConvDebug] Transcription result:', JSON.stringify(transcribeResult).slice(0, 500));

      if (transcribeResult.success && transcribeResult.result) {
        const text = transcribeResult.result.text;
        console.log('[ConvDebug] Transcribed text:', text);

        await window.electronAPI.addConversationMessage(text, speaker);
        console.log('[ConvDebug] Message added. Speaker:', speaker, '- Fetching AI?', speaker === 'interviewer');

        if (speaker === 'interviewer') {
          console.log('[ConvDebug] Fetching AI suggestions...');
          await fetchAISuggestions(text);
          console.log('[ConvDebug] AI suggestions fetch complete');
        }
      } else {
        console.log('[ConvDebug] Transcription failed or empty result:', transcribeResult);
      }
    } catch (error: any) {
      console.error('[ConvDebug] Failed to process recording:', error);
      alert(error.message || 'Failed to process recording');
    } finally {
      updateProcessingStatus(-1);
    }
  };

  const updateProcessingStatus = (delta: number) => {
    processingCountRef.current = Math.max(0, processingCountRef.current + delta);
    setIsProcessing(processingCountRef.current > 0);
  };

  const fetchAISuggestions = async (question: string) => {
    console.log('[ConvDebug] fetchAISuggestions called with:', question);
    try {
      // Get problem statement from query cache if available (from screenshots)
      const problemStatement = queryClient.getQueryData(['problem_statement']) as any;
      let screenshotContext: string | undefined;

      if (problemStatement?.problem_statement) {
        screenshotContext = `Problem Statement: ${problemStatement.problem_statement}\nConstraints: ${problemStatement.constraints || 'N/A'}\nExample Input: ${problemStatement.example_input || 'N/A'}\nExample Output: ${problemStatement.example_output || 'N/A'}`;
      }

      // Get candidate profile from config
      const config = await window.electronAPI.getConfig();
      const candidateProfile = (config as any).candidateProfile;
      console.log('[ConvDebug] Calling getAnswerSuggestions, hasScreenshot:', !!screenshotContext, 'hasProfile:', !!candidateProfile);

      const result = await window.electronAPI.getAnswerSuggestions(question, screenshotContext, candidateProfile);
      console.log('[ConvDebug] AI result:', JSON.stringify(result).slice(0, 500));
      if (result.success && result.suggestions) {
        setAiSuggestions(result.suggestions);
        // Add AI response inline in the conversation
        const aiText = result.suggestions.suggestions
          ? result.suggestions.suggestions.join('\n\n')
          : Array.isArray(result.suggestions)
            ? result.suggestions.join('\n\n')
            : String(result.suggestions);
        const aiMessage: ConversationMessage = {
          id: `ai-${Date.now()}`,
          speaker: 'ai',
          text: aiText,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, aiMessage]);
        scrollToBottom();
        console.log('[ConvDebug] AI suggestions set and added to conversation');
      } else {
        console.log('[ConvDebug] AI result not successful or no suggestions:', result);
      }
    } catch (error: any) {
      console.error('[ConvDebug] Failed to get AI suggestions:', error);
    }
  };

  const handleToggleSpeaker = async () => {
    try {
      const result = await window.electronAPI.toggleSpeaker();
      if (result.success) {
        setCurrentSpeaker(result.speaker);
        currentSpeakerRef.current = result.speaker;
        // Don't clear suggestions - user needs to see them when preparing their answer!
      }
    } catch (error) {
      console.error('Failed to toggle speaker:', error);
    }
  };

  const toggleSpeakerForNextTurn = async () => {
    try {
      const result = await window.electronAPI.toggleSpeaker();
      if (result.success) {
        setCurrentSpeaker(result.speaker);
        currentSpeakerRef.current = result.speaker;
      }
    } catch (error) {
      console.error('Failed to auto-toggle speaker:', error);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Conversation Commands Bar - Matches QueueCommands/SolutionCommands style */}
      <ConversationCommands
        onTooltipVisibilityChange={handleTooltipVisibilityChange}
        isRecording={isRecording}
        isProcessing={isProcessing}
        recordingDuration={recordingDuration}
        currentSpeaker={currentSpeaker}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        onToggleSpeaker={handleToggleSpeaker}
        onClearConversation={handleClearConversation}
      />

      {/* Scrollable Conversation Area - hidden in controls-only mode */}
      {!controlsOnly && (
      <div
        ref={scrollContainerRef}
        className="overflow-y-auto flex-1 min-h-0 mb-3 pr-2 mt-2"
      >
        {messages.length > 0 && (
          <ContentSection
            title="Conversation"
            content={
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex flex-col ${
                      message.speaker === 'interviewer'
                        ? 'items-start'
                        : message.speaker === 'ai'
                          ? 'items-center'
                          : 'items-end'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-2.5 ${
                        message.speaker === 'interviewer'
                          ? 'bg-blue-600/20 border border-blue-500/30'
                          : message.speaker === 'ai'
                            ? 'bg-purple-600/20 border border-purple-500/30'
                            : 'bg-green-600/20 border border-green-500/30'
                      }`}
                    >
                      <div className="text-xs text-white/60 mb-1">
                        {message.speaker === 'interviewer'
                          ? '👤 Interviewer'
                          : message.speaker === 'ai'
                            ? '🤖 AI Suggestion'
                            : '🎤 You'}
                      </div>
                      <div className="text-white text-[13px] whitespace-pre-line">{message.text}</div>
                      <div className="text-xs text-white/40 mt-1">
                        {formatTime(message.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            }
            isLoading={false}
          />
        )}
        <div ref={messagesEndRef} />
      </div>
      )}

    </div>
  );
};
