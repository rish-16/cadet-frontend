import { Classes } from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';
import classNames from 'classnames';
import { isStepperOutput } from 'js-slang/dist/stepper/stepper';
import { Variant } from 'js-slang/dist/types';
import { isEqual } from 'lodash';
import * as React from 'react';
import { HotKeys } from 'react-hotkeys';
import { RouteComponentProps } from 'react-router';

import { InterpreterOutput } from '../../commons/application/ApplicationTypes';
import { ExternalLibraryName } from '../../commons/application/types/ExternalTypes';
import { ControlBarAutorunButtons } from '../../commons/controlBar/ControlBarAutorunButtons';
import { ControlBarChapterSelect } from '../../commons/controlBar/ControlBarChapterSelect';
import { ControlBarClearButton } from '../../commons/controlBar/ControlBarClearButton';
import { ControlBarEvalButton } from '../../commons/controlBar/ControlBarEvalButton';
import { ControlBarExecutionTime } from '../../commons/controlBar/ControlBarExecutionTime';
import { ControlBarExternalLibrarySelect } from '../../commons/controlBar/ControlBarExternalLibrarySelect';
import { ControlBarPersistenceButtons } from '../../commons/controlBar/ControlBarPersistenceButtons';
import { ControlBarSessionButtons } from '../../commons/controlBar/ControlBarSessionButton';
import { ControlBarShareButton } from '../../commons/controlBar/ControlBarShareButton';
import { ControlBarStepLimit } from '../../commons/controlBar/ControlBarStepLimit';
import { HighlightedLines, Position } from '../../commons/editor/EditorTypes';
import Markdown from '../../commons/Markdown';
import SideContentEnvVisualizer from '../../commons/sideContent/SideContentEnvVisualizer';
import SideContentFaceapiDisplay from '../../commons/sideContent/SideContentFaceapiDisplay';
import SideContentInspector from '../../commons/sideContent/SideContentInspector';
import SideContentListVisualizer from '../../commons/sideContent/SideContentListVisualizer';
import SideContentSubstVisualizer from '../../commons/sideContent/SideContentSubstVisualizer';
import { SideContentTab, SideContentType } from '../../commons/sideContent/SideContentTypes';
import SideContentVideoDisplay from '../../commons/sideContent/SideContentVideoDisplay';
import { generateSourceIntroduction } from '../../commons/utils/IntroductionHelper';
import Workspace, { WorkspaceProps } from '../../commons/workspace/Workspace';
import {
  getAssessmentLogs,
  getLoggedAssessmentIds,
  getPlaygroundLogs,
  getResetLoggingFlag, 
  hasExceededLocalStorageSpace,
  oneHourInMilliSeconds,
  playgroundQuestionId,
  resetPlaygroundLogging,
  savePlaygroundLog,
} from '../../features/keystrokes/KeystrokesHelper';
import { PersistenceFile } from '../../features/persistence/PersistenceTypes';
import {
  CodeDelta,
  Input,
  PlaybackData,
  SelectionRange
} from '../../features/sourceRecorder/SourceRecorderTypes';

export type PlaygroundProps = DispatchProps & StateProps & RouteComponentProps<{}>;

export type DispatchProps = {
  handleActiveTabChange: (activeTab: SideContentType) => void;
  handleBrowseHistoryDown: () => void;
  handleBrowseHistoryUp: () => void;
  handleChangeExecTime: (execTime: number) => void;
  handleChangeStepLimit: (stepLimit: number) => void;
  handleChapterSelect: (chapter: number, variant: Variant) => void;
  handleDeclarationNavigate: (cursorPosition: Position) => void;
  handleEditorEval: () => void;
  handleEditorHeightChange: (height: number) => void;
  handleEditorValueChange: (val: string) => void;
  handleEditorWidthChange: (widthChange: number) => void;
  handleEditorUpdateBreakpoints: (breakpoints: string[]) => void;
  handleFetchSublanguage: () => void;
  handleGenerateLz: () => void;
  handleShortenURL: (s: string) => void;
  handleUpdateShortURL: (s: string) => void;
  handleInterruptEval: () => void;
  handleExternalSelect: (externalLibraryName: ExternalLibraryName, force?: boolean) => void;
  handleReplEval: () => void;
  handleReplOutputClear: () => void;
  handleReplValueChange: (newValue: string) => void;
  handleSendReplInputToOutput: (code: string) => void;
  handleSetEditorSessionId: (editorSessionId: string) => void;
  handleSetSharedbConnected: (connected: boolean) => void;
  handleSideContentHeightChange: (heightChange: number) => void;
  handleUsingSubst: (usingSubst: boolean) => void;
  handleDebuggerPause: () => void;
  handleDebuggerResume: () => void;
  handleDebuggerReset: () => void;
  handleToggleEditorAutorun: () => void;
  handleFetchChapter: () => void;
  handlePromptAutocomplete: (row: number, col: number, callback: any) => void;
  handlePersistenceOpenPicker: () => void;
  handlePersistenceSaveFile: () => void;
  handlePersistenceUpdateFile: (file: PersistenceFile) => void;
  handlePersistenceInitialise: () => void;
  handlePersistenceLogOut: () => void;
  handleKeystrokeUpload: (
    assessmentId: number,
    questionId: number,
    playbackData: PlaybackData
  ) => void;
};

export type StateProps = {
  editorSessionId: string;
  editorValue: string;
  editorHeight?: number;
  editorWidth: string;
  execTime: number;
  breakpoints: string[];
  highlightedLines: HighlightedLines[];
  isEditorAutorun: boolean;
  isRunning: boolean;
  isDebugging: boolean;
  enableDebugging: boolean;
  newCursorPosition?: Position;
  output: InterpreterOutput[];
  queryString?: string;
  shortURL?: string;
  replValue: string;
  sideContentHeight?: number;
  sourceChapter: number;
  sourceVariant: Variant;
  stepLimit: number;
  sharedbConnected: boolean;
  externalLibraryName: ExternalLibraryName;
  usingSubst: boolean;
  persistenceUser: string | undefined;
  persistenceFile: PersistenceFile | undefined;
};

const keyMap = { goGreen: 'h u l k' };

const Playground: React.FC<PlaygroundProps> = props => {
  const propsRef = React.useRef(props);
  propsRef.current = props;
  const [lastEdit, setLastEdit] = React.useState(new Date());
  const [isGreen, setIsGreen] = React.useState(false);
  const [selectedTab, setSelectedTab] = React.useState(SideContentType.introduction);
  const [hasBreakpoints, setHasBreakpoints] = React.useState(false);

  React.useEffect(() => {
    // Fixes some errors with runes and curves (see PR #1420)
    propsRef.current.handleExternalSelect(propsRef.current.externalLibraryName, true);

    // Only fetch default Playground sublanguage when not loaded via a share link
    if (propsRef.current.location.hash === '') {
      propsRef.current.handleFetchSublanguage();
    }
  }, []);

  const handlers = React.useMemo(
    () => ({
      goGreen: () => setIsGreen(!isGreen)
    }),
    [isGreen]
  );

  const onEditorValueChange = React.useCallback(val => {
    setLastEdit(new Date());
    propsRef.current.handleEditorValueChange(val);
  }, []);

  const onChangeTabs = React.useCallback(
    (
      newTabId: SideContentType,
      prevTabId: SideContentType,
      event: React.MouseEvent<HTMLElement>
    ) => {
      if (newTabId === prevTabId) {
        return;
      }

      const { handleUsingSubst, handleReplOutputClear, sourceChapter } = propsRef.current;

      if (sourceChapter <= 2 && newTabId === SideContentType.substVisualizer) {
        handleUsingSubst(true);
      }

      if (prevTabId === SideContentType.substVisualizer && !hasBreakpoints) {
        handleReplOutputClear();
        handleUsingSubst(false);
      }

      setSelectedTab(newTabId);
    },
    [hasBreakpoints]
  );

  const processStepperOutput = (output: InterpreterOutput[]) => {
    const editorOutput = output[0];
    if (
      editorOutput &&
      editorOutput.type === 'result' &&
      editorOutput.value instanceof Array &&
      editorOutput.value[0] === Object(editorOutput.value[0]) &&
      isStepperOutput(editorOutput.value[0])
    ) {
      return editorOutput.value;
    } else {
      return [];
    }
  };

  const uploadLogs = React.useCallback(() => {
    const assessmentIDs = getLoggedAssessmentIds();
    const assessmentLogs = getAssessmentLogs();
    const playgroundLogs = getPlaygroundLogs();

    if (assessmentLogs.inputs.length !== 0) {
      props.handleKeystrokeUpload(
        assessmentIDs.assessmentId,
        assessmentIDs.questionId,
        assessmentLogs
      );
    }

    if (playgroundLogs.inputs.length !== 0) {
      props.handleKeystrokeUpload(playgroundQuestionId, playgroundQuestionId, playgroundLogs);
    }

    if (getResetLoggingFlag()) {
      resetPlaygroundLogging(props.sourceChapter, props.externalLibraryName, props.editorValue);
    }
  }, [props]);

  const handleEvalCallback = React.useCallback(() => {
    props.handleEditorEval();
    uploadLogs();
  }, [props, uploadLogs]);

  const pushLog = React.useCallback(
    (newInput: Input) => {
      savePlaygroundLog(newInput);

      if (hasExceededLocalStorageSpace()) {
        uploadLogs();
      }
    },
    [uploadLogs]
  );

  const autorunButtons = React.useMemo(
    () => (
      <ControlBarAutorunButtons
        handleDebuggerPause={props.handleDebuggerPause}
        handleDebuggerReset={props.handleDebuggerReset}
        handleDebuggerResume={props.handleDebuggerResume}
        handleEditorEval={handleEvalCallback}
        handleInterruptEval={props.handleInterruptEval}
        handleToggleEditorAutorun={props.handleToggleEditorAutorun}
        isDebugging={props.isDebugging}
        isEditorAutorun={props.isEditorAutorun}
        isRunning={props.isRunning}
        key="autorun"
      />
    ),
    [
      props.handleDebuggerPause,
      props.handleDebuggerReset,
      props.handleDebuggerResume,
      handleEvalCallback,
      props.handleInterruptEval,
      props.handleToggleEditorAutorun,
      props.isDebugging,
      props.isEditorAutorun,
      props.isRunning
    ]
  );

  const chapterSelectHandler = React.useCallback(
    ({ chapter, variant }: { chapter: number; variant: Variant }, e: any) => {
      const { handleUsingSubst, handleReplOutputClear, handleChapterSelect } = propsRef.current;
      if ((chapter <= 2 && hasBreakpoints) || selectedTab === SideContentType.substVisualizer) {
        handleUsingSubst(true);
      }
      if (chapter > 2) {
        handleReplOutputClear();
        handleUsingSubst(false);
      }

      const input: Input = {
        time: Date.now(),
        type: 'chapterSelect',
        data: chapter
      };

      pushLog(input);

      handleChapterSelect(chapter, variant);
    },
    [hasBreakpoints, selectedTab, pushLog]
  );

  const chapterSelect = React.useMemo(
    () => (
      <ControlBarChapterSelect
        handleChapterSelect={chapterSelectHandler}
        sourceChapter={props.sourceChapter}
        sourceVariant={props.sourceVariant}
        key="chapter"
      />
    ),
    [chapterSelectHandler, props.sourceChapter, props.sourceVariant]
  );

  const clearButton = React.useMemo(
    () =>
      selectedTab === SideContentType.substVisualizer ? null : (
        <ControlBarClearButton
          handleReplOutputClear={props.handleReplOutputClear}
          key="clear_repl"
        />
      ),
    [props.handleReplOutputClear, selectedTab]
  );

  const evalButton = React.useMemo(
    () =>
      selectedTab === SideContentType.substVisualizer ? null : (
        <ControlBarEvalButton
          handleReplEval={props.handleReplEval}
          isRunning={props.isRunning}
          key="eval_repl"
        />
      ),
    [props.handleReplEval, props.isRunning, selectedTab]
  );

  const { persistenceUser, persistenceFile, handlePersistenceUpdateFile } = props;
  // Compute this here to avoid re-rendering the button every keystroke
  const persistenceIsDirty =
    persistenceFile && (!persistenceFile.lastSaved || persistenceFile.lastSaved < lastEdit);
  const persistenceButtons = React.useMemo(() => {
    return (
      <ControlBarPersistenceButtons
        currentFile={persistenceFile}
        loggedInAs={persistenceUser}
        isDirty={persistenceIsDirty}
        key="googledrive"
        onClickSaveAs={props.handlePersistenceSaveFile}
        onClickOpen={props.handlePersistenceOpenPicker}
        onClickSave={
          persistenceFile ? () => handlePersistenceUpdateFile(persistenceFile) : undefined
        }
        onClickLogOut={props.handlePersistenceLogOut}
        onPopoverOpening={props.handlePersistenceInitialise}
      />
    );
  }, [
    persistenceUser,
    persistenceFile,
    persistenceIsDirty,
    props.handlePersistenceSaveFile,
    props.handlePersistenceOpenPicker,
    props.handlePersistenceLogOut,
    props.handlePersistenceInitialise,
    handlePersistenceUpdateFile
  ]);

  const executionTime = React.useMemo(
    () => (
      <ControlBarExecutionTime
        execTime={props.execTime}
        handleChangeExecTime={props.handleChangeExecTime}
        key="execution_time"
      />
    ),
    [props.execTime, props.handleChangeExecTime]
  );

  const stepperStepLimit = React.useMemo(
    () => (
      <ControlBarStepLimit
        stepLimit={props.stepLimit}
        handleChangeStepLimit={props.handleChangeStepLimit}
        key="step_limit"
      />
    ),
    [props.handleChangeStepLimit, props.stepLimit]
  );

  const { handleExternalSelect, externalLibraryName, handleEditorValueChange } = props;

  const handleExternalSelectAndRecord = React.useCallback(
    (name: ExternalLibraryName) => {
      handleExternalSelect(name);

      const input: Input = {
        time: Date.now(),
        type: 'externalLibrarySelect',
        data: name
      };

      pushLog(input);
    },
    [handleExternalSelect, pushLog]
  );

  const externalLibrarySelect = React.useMemo(
    () => (
      <ControlBarExternalLibrarySelect
        externalLibraryName={externalLibraryName}
        handleExternalSelect={({ name }: { name: ExternalLibraryName }, e: any) =>
          handleExternalSelectAndRecord(name)
        }
        key="external_library"
      />
    ),
    [externalLibraryName, handleExternalSelectAndRecord]
  );

  // No point memoing this, it uses props.editorValue
  const sessionButtons = (
    <ControlBarSessionButtons
      editorSessionId={props.editorSessionId}
      editorValue={props.editorValue}
      handleSetEditorSessionId={props.handleSetEditorSessionId}
      sharedbConnected={props.sharedbConnected}
      key="session"
    />
  );

  const shareButton = React.useMemo(
    () => (
      <ControlBarShareButton
        handleGenerateLz={props.handleGenerateLz}
        handleShortenURL={props.handleShortenURL}
        handleUpdateShortURL={props.handleUpdateShortURL}
        queryString={props.queryString}
        shortURL={props.shortURL}
        key="share"
      />
    ),
    [
      props.handleGenerateLz,
      props.handleShortenURL,
      props.handleUpdateShortURL,
      props.queryString,
      props.shortURL
    ]
  );

  const playgroundIntroductionTab: SideContentTab = React.useMemo(
    () => ({
      label: 'Introduction',
      iconName: IconNames.COMPASS,
      body: (
        <Markdown
          content={generateSourceIntroduction(props.sourceChapter, props.sourceVariant)}
          openLinksInNewWindow={true}
        />
      ),
      id: SideContentType.introduction,
      toSpawn: () => true
    }),
    [props.sourceChapter, props.sourceVariant]
  );

  const tabs = React.useMemo(() => {
    const tabs: SideContentTab[] = [playgroundIntroductionTab];

    // Conditional logic for tab rendering
    if (
      props.externalLibraryName === ExternalLibraryName.PIXNFLIX ||
      props.externalLibraryName === ExternalLibraryName.ALL
    ) {
      // Enable video tab only when 'PIX&FLIX' is selected
      tabs.push(videoDisplayTab);
    }
    if (props.externalLibraryName === ExternalLibraryName.MACHINELEARNING) {
      // Enable Face API Display only when 'MACHINELEARNING' is selected
      tabs.push(FaceapiDisplayTab);
    }
    if (props.sourceChapter >= 2) {
      // Enable Data Visualizer for Source Chapter 2 and above
      tabs.push(listVisualizerTab);
    }
    if (
      props.sourceChapter >= 3 &&
      props.sourceVariant !== 'concurrent' &&
      props.sourceVariant !== 'non-det'
    ) {
      // Enable Inspector, Env Visualizer for Source Chapter 3 and above
      tabs.push(inspectorTab);
      tabs.push(envVisualizerTab);
    }

    if (props.sourceChapter <= 2 && props.sourceVariant === 'default') {
      // Enable Subst Visualizer only for default Source 1 & 2
      tabs.push({
        label: 'Stepper',
        iconName: IconNames.FLOW_REVIEW,
        body: <SideContentSubstVisualizer content={processStepperOutput(props.output)} />,
        id: SideContentType.substVisualizer,
        toSpawn: () => true
      });
    }
    return tabs;
  }, [
    playgroundIntroductionTab,
    props.externalLibraryName,
    props.output,
    props.sourceChapter,
    props.sourceVariant
  ]);

  const onChangeMethod = (newCode: string, delta: CodeDelta) => {
    handleEditorValueChange(newCode);

    const input: Input = {
      time: Date.now(),
      type: 'codeDelta',
      data: delta
    };

    pushLog(input);
  };

  const onCursorChangeMethod = (selection: any) => {
    const input: Input = {
      time: Date.now(),
      type: 'cursorPositionChange',
      data: selection.getCursor()
    };

    pushLog(input);
  };

  const onSelectionChangeMethod = (selection: any) => {
    const range: SelectionRange = selection.getRange();
    const isBackwards: boolean = selection.isBackwards();
    if (!isEqual(range.start, range.end)) {
      const input: Input = {
        time: Date.now(),
        type: 'selectionRangeData',
        data: { range, isBackwards }
      };

      pushLog(input);
    }
  };

  const handleEditorUpdateBreakpoints = React.useCallback(
    (breakpoints: string[]) => {
      // get rid of holes in array
      const numberOfBreakpoints = breakpoints.filter(arrayItem => !!arrayItem).length;
      if (numberOfBreakpoints > 0) {
        setHasBreakpoints(true);
        if (propsRef.current.sourceChapter <= 2) {
          /**
           * There are breakpoints set on Source Chapter 2, so we set the
           * Redux state for the editor to evaluate to the substituter
           */

          propsRef.current.handleUsingSubst(true);
        }
      }
      if (numberOfBreakpoints === 0) {
        setHasBreakpoints(false);

        if (selectedTab !== SideContentType.substVisualizer) {
          propsRef.current.handleReplOutputClear();
          propsRef.current.handleUsingSubst(false);
        }
      }
      propsRef.current.handleEditorUpdateBreakpoints(breakpoints);
    },
    [selectedTab]
  );

  const workspaceProps: WorkspaceProps = {
    controlBarProps: {
      editorButtons: [
        autorunButtons,
        shareButton,
        chapterSelect,
        props.sourceVariant !== 'concurrent' ? externalLibrarySelect : null,
        sessionButtons,
        persistenceButtons,
        props.usingSubst ? stepperStepLimit : executionTime
      ],
      replButtons: [
        props.sourceVariant !== 'concurrent' && props.sourceVariant !== 'wasm' ? evalButton : null,
        clearButton
      ]
    },
    editorProps: {
      onChangeMethod: onChangeMethod,
      onCursorChangeMethod: onCursorChangeMethod,
      onSelectionChangeMethod: onSelectionChangeMethod,
      sourceChapter: props.sourceChapter,
      externalLibraryName: props.externalLibraryName,
      sourceVariant: props.sourceVariant,
      editorValue: props.editorValue,
      editorSessionId: props.editorSessionId,
      handleDeclarationNavigate: props.handleDeclarationNavigate,
      handleEditorEval: props.handleEditorEval,
      handleEditorValueChange: onEditorValueChange,
      handleSendReplInputToOutput: props.handleSendReplInputToOutput,
      handlePromptAutocomplete: props.handlePromptAutocomplete,
      isEditorAutorun: props.isEditorAutorun,
      breakpoints: props.breakpoints,
      highlightedLines: props.highlightedLines,
      newCursorPosition: props.newCursorPosition,
      handleEditorUpdateBreakpoints: handleEditorUpdateBreakpoints,
      handleSetSharedbConnected: props.handleSetSharedbConnected
    },
    editorHeight: props.editorHeight,
    editorWidth: props.editorWidth,
    handleEditorHeightChange: props.handleEditorHeightChange,
    handleEditorWidthChange: props.handleEditorWidthChange,
    handleSideContentHeightChange: props.handleSideContentHeightChange,
    replProps: {
      sourceChapter: props.sourceChapter,
      sourceVariant: props.sourceVariant,
      externalLibrary: props.externalLibraryName,
      output: props.output,
      replValue: props.replValue,
      handleBrowseHistoryDown: props.handleBrowseHistoryDown,
      handleBrowseHistoryUp: props.handleBrowseHistoryUp,
      handleReplEval: props.handleReplEval,
      handleReplValueChange: props.handleReplValueChange,
      hidden: selectedTab === SideContentType.substVisualizer,
      usingSubst: props.usingSubst
    },
    sideContentHeight: props.sideContentHeight,
    sideContentProps: {
      defaultSelectedTabId: selectedTab,
      handleActiveTabChange: props.handleActiveTabChange,
      onChange: onChangeTabs,
      tabs,
      workspaceLocation: 'playground'
    },
    sideContentIsResizeable: selectedTab !== SideContentType.substVisualizer
  };

  return (
    <HotKeys
      className={classNames('Playground', Classes.DARK, isGreen ? 'GreenScreen' : undefined)}
      keyMap={keyMap}
      handlers={handlers}
    >
      <Workspace {...workspaceProps} />
    </HotKeys>
  );
};

const listVisualizerTab: SideContentTab = {
  label: 'Data Visualizer',
  iconName: IconNames.EYE_OPEN,
  body: <SideContentListVisualizer />,
  id: SideContentType.dataVisualiser,
  toSpawn: () => true
};

const videoDisplayTab: SideContentTab = {
  label: 'Video Display',
  iconName: IconNames.MOBILE_VIDEO,
  body: <SideContentVideoDisplay />,
  toSpawn: () => true
};

const FaceapiDisplayTab: SideContentTab = {
  label: 'Face API Display',
  iconName: IconNames.MUGSHOT,
  body: <SideContentFaceapiDisplay />,
  toSpawn: () => true
};

const inspectorTab: SideContentTab = {
  label: 'Inspector',
  iconName: IconNames.SEARCH,
  body: <SideContentInspector />,
  id: SideContentType.inspector,
  toSpawn: () => true
};

const envVisualizerTab: SideContentTab = {
  label: 'Env Visualizer',
  iconName: IconNames.GLOBE,
  body: <SideContentEnvVisualizer />,
  id: SideContentType.envVisualiser,
  toSpawn: () => true
};

export default Playground;
