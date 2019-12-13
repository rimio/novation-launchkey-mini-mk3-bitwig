loadAPI(9);

//
// User configurable parameters
//
const CFG_UNRAVEL_DRUM_PADS         = true;
const CFG_DRUM_PAD_JUMP_SIZE        = 16;

//
// Device initialization
//
host.setShouldFailOnDeprecatedUse(true);
host.defineController("Novation", "LaunchKey Mini MK3", "0.1", "d57c9dab-ca6e-4302-a9ed-6de0a49ce8c3", "Rimio");
host.defineMidiPorts(2, 2);

if (host.platformIsWindows())
{
   host.addDeviceNameBasedDiscoveryPair(["Launchkey Mini MK3", "MIDIIN2 (Launchkey Mini MK3)"], ["Launchkey Mini MK3", "MIDIOUT2 (Launchkey Mini MK3)"]);
}
else if (host.platformIsMac())
{
   // TODO: Set the correct names of the ports for auto detection on Mac OSX platform here
}
else if (host.platformIsLinux())
{
   // TODO: Set the correct names of the ports for auto detection on Linux platform here
}

//
// Constants
//

// Commands
const EVT_NOTE_OFF            = 0x08;
const EVT_NOTE_ON             = 0x09;
const EVT_CONTROL_CHANGE      = 0x0B;
const EVT_PROGRAM_CHANGE      = 0x0C;

// Channels
const LKM_CHANNEL_KEYS        = 0x00;
const LKM_CHANNEL_BUTTONS     = 0x00;
const LKM_CHANNEL_PROGRAM     = 0x00;
const LKM_CHANNEL_DRUM_PADS   = 0x09;
const LKM_CHANNEL_PADS        = 0x0F;
const LKM_CHANNEL_PITCH_BEND  = 0x00;
const LKM_CHANNEL_MODULATION  = 0x00;
const LKM_CHANNEL_POTS        = 0x00;
const LKM_CHANNEL_MODE        = 0x0F;

// Button codes
const LKM_BUTTON_PLAY         = 0x73;
const LKM_BUTTON_RECORD       = 0x75;

const LKM_BUTTON_LEFT         = 0x67;
const LKM_BUTTON_RIGHT        = 0x66;
const LKM_BUTTON_UP           = 0x6A;
const LKM_BUTTON_DOWN         = 0x6B;

const LKM_BUTTON_MODE         = 0x03;
const LKM_BUTTON_MODE_SELECT  = 0x69;

// Key codes
const LKM_KEYBOARD_LOW        = 0x0C;
const LKM_KEYBOARD_HIGH       = 0x6C;

// Drum pad codes
const LKM_DRUM_PADS_LOW       = 0x24;
const LKM_DRUM_PADS_HIGH      = 0x33;

const LKM_DRUM_PADS_CC_SEQ_1  = 0x33;
const LKM_DRUM_PADS_CC_SEQ_2  = 0x2F;

// Pads codes
const LKM_PADS_LOW            = 0x70;
const LKM_PADS_HALF           = 0x77;
const LKM_PADS_HIGH           = 0x7f;

// Slider code (pitch bend is treated separately)
const LKM_MODULATION          = 0x01;

// Potentiometer codes
const LKM_POT_LOW             = 0x08;
const LKM_POT_HIGH            = 0x0F;

// Mode codes
const LKM_MODE_DRUMS          = 0x01;
const LKM_MODE_CUSTOM         = 0x00;

//
// Device state
//
var transport = null;

var trackBank = null;
var cursorTrack = null;

var keyInput = null;
var drumPadsInput = null;
var pitchBendInput = null;
var modulationInput = null;

var changeDrumPadColorState = 0;

var modeEnum = {
   DRUMS : 0,
   CUSTOM : 1,
   CUSTOM_SELECT : 2
}
var currentMode = modeEnum.DRUMS;

//
// Create a pad mapping
//
function getDrumPadsMap(startKey, linearize) {
   map = initArray(-1, 128);
   if (linearize) {
      var remap = [4, 5, 6, 7, 12, 13, 14, 15, 0, 1, 2, 3, 8, 9, 10, 11];
      for (i = LKM_DRUM_PADS_LOW; i <= LKM_DRUM_PADS_HIGH; i++) {
         map[i] = (startKey + remap[i - LKM_DRUM_PADS_LOW]) & 0x7F;
      }
   } else {
      for (i = LKM_DRUM_PADS_LOW; i <= LKM_DRUM_PADS_HIGH; i++) {
         map[i] = (startKey + i - LKM_DRUM_PADS_LOW) & 0x7F;
      }
   }

   return map;
}

//
// isPlaying observer
//
function isPlayingObserver(play) {
   // TODO: Figure out play button LED behaviour
}

//
// isPlaying observer
//
function isRecordingObserver(play) {
   // TODO: Figure out recording button LED behaviour
}

//
// Update all colors in custom mode
//
function updateCustomModeColors() {
   // Submode change button
   host.getMidiOutPort(1).sendMidi((EVT_CONTROL_CHANGE << 4) | LKM_CHANNEL_BUTTONS, LKM_BUTTON_MODE_SELECT, (currentMode == modeEnum.CUSTOM_SELECT ? 3 : 0));

   if (currentMode == modeEnum.CUSTOM_SELECT) {
      // Set track colors
      for (i = 0; i < 8; i ++) {
         var track = trackBank.getItemAt(i);
      }
   } else if (currentMode == modeEnum.CUSTOM) {
      // Normal submode
   }
}

//
// Device initialization callback
//
function init() {
   // Transport object
   transport = host.createTransport();

   // Keys passtrough
   keyInput = host.getMidiInPort(0).createNoteInput("LaunchKey Mini MK3 - Keys", "90????", "80????");

   // Drum pads passtrough and initial translation table
   drumPadsInput = host.getMidiInPort(0).createNoteInput("LaunchKey Mini MK3 - Keys", "99????", "89????");
   drumPadsInput.setKeyTranslationTable(getDrumPadsMap(LKM_DRUM_PADS_LOW, CFG_UNRAVEL_DRUM_PADS));
   drumPadsInput.setShouldConsumeEvents(false);

   // Pitch bend passtrough
   pitchBendInput = host.getMidiInPort(0).createNoteInput("LaunchKey Mini MK3 - Pitch bend", "E0????");

   // Modulation passtrough
   modulationInput = host.getMidiInPort(0).createNoteInput("LaunchKey Mini MK3 - Modulation", "B001??");

   // Create track bank
   trackBank = host.createMainTrackBank(8, 0, 0);
   cursorTrack = host.createCursorTrack("LKM_CURSOR_TRACK", "Cursor Track", 0, 0, true);
   for (i = 0; i < trackBank.getSizeOfBank(); i ++) {
      var track = trackBank.getItemAt(i);
      track.pan().markInterested();
      track.pan().setIndication(true);
      track.volume().markInterested();
      track.volume().setIndication(true);
   }
   trackBank.followCursorTrack(cursorTrack);
   cursorTrack.solo().markInterested();
   cursorTrack.mute().markInterested();

   // Set observers after initialisation
   transport.isPlaying().addValueObserver(isPlayingObserver);
   transport.isArrangerRecordEnabled().addValueObserver(isRecordingObserver);

   // Set callbacks after initialization
   host.getMidiInPort(0).setMidiCallback(onMidi0);
   host.getMidiInPort(0).setSysexCallback(onSysex0);
   host.getMidiInPort(1).setMidiCallback(onMidi1);
   host.getMidiInPort(1).setSysexCallback(onSysex1);

   // Prompt
   println("LaunchKey Mini MK3 initialized!");
}

//
// Device deinitialization callback
//
function exit() {
}

//
// Flush callback
//
function flush() {
}

//
// MIDI0 event
//
function onMidi0(status, data1, data2) {
   // Extract event and channel
   var event = (status & 0xF0) >>> 4;
   var channel = status & 0x0F;
   var key = data1 & 0x7F;
   var value = data2 & 0x7F;

   // Debug
   printMidi(status, data1, data2);
   println("Slot 0 | E=" + event.toString(16) + " C=" + channel.toString(16) + " K=" + key.toString(16) + " V=" + value.toString(16));

   // Play and record buttons
   if ((event == EVT_CONTROL_CHANGE) && (channel == LKM_CHANNEL_BUTTONS))
   {
      // We are only interested in the button down event, so we look for the
      // high value of 7F. The down event is encoded with the value 00.
      if (value == 0x7F) {
         if (key == LKM_BUTTON_PLAY) {
            transport.togglePlay();
         } else if (key == LKM_BUTTON_RECORD) {
            transport.record();
         }
      }
   }

   // Drum pads shifting
   if ((event == EVT_PROGRAM_CHANGE) && (channel == LKM_CHANNEL_PROGRAM)) {
      var sign = (key & 0x40) >>> 6;
      var val = key & 0x3F;
      var signedProgram = (sign ? val - 0x3F - 1 : val);
      var startKey = LKM_DRUM_PADS_LOW + signedProgram * CFG_DRUM_PAD_JUMP_SIZE;
      drumPadsInput.setKeyTranslationTable(getDrumPadsMap(startKey, CFG_UNRAVEL_DRUM_PADS));
   }

   // Drum pads
   if ((event == EVT_NOTE_ON || event == EVT_NOTE_OFF) && (channel == LKM_CHANNEL_DRUM_PADS)) {
      // Drum pads color changing sequence
      if ((key == LKM_DRUM_PADS_CC_SEQ_1) && (event == EVT_NOTE_ON) && (changeDrumPadColorState == 0)) {
         changeDrumPadColorState = 1;
      } else if ((key == LKM_DRUM_PADS_CC_SEQ_1) && (event == EVT_NOTE_OFF) && (changeDrumPadColorState == 1)) {
         changeDrumPadColorState = 2;
      } else if ((key == LKM_DRUM_PADS_CC_SEQ_2) && (event == EVT_NOTE_ON) && (changeDrumPadColorState == 2)) {
         changeDrumPadColorState = 3;
      } else {
         // Reset color changing sequence on any other event
         changeDrumPadColorState = 0;
      }
   }

   // Bank scrolling
   if ((event == EVT_CONTROL_CHANGE) && (channel == LKM_CHANNEL_BUTTONS)) {
      if ((key == LKM_BUTTON_LEFT) && (value == 0x7F)) {
         trackBank.scrollPageBackwards();
      }
      if ((key == LKM_BUTTON_RIGHT) && (value == 0x7F)) {
         trackBank.scrollPageForwards();
      }
   }

   // Custom mode switching
   if ((event == EVT_CONTROL_CHANGE) && (channel == LKM_CHANNEL_BUTTONS) && (key == LKM_BUTTON_MODE_SELECT) && (value == 0x7F)) {
      if (currentMode == modeEnum.CUSTOM) {
         currentMode = modeEnum.CUSTOM_SELECT;
         updateCustomModeColors();
      } else if (currentMode == modeEnum.CUSTOM_SELECT) {
         currentMode = modeEnum.CUSTOM;
         updateCustomModeColors();
      }
   }

   // Track selection
   if ((currentMode == modeEnum.CUSTOM_SELECT) && (event == EVT_NOTE_ON) && (channel == LKM_CHANNEL_PADS)) {
      if ((key >= LKM_PADS_LOW) && (key <= LKM_PADS_HALF)) {
         var index = key - LKM_PADS_LOW;
         trackBank.getItemAt(index).select();
      }
   }

   // Volume and color control
   if ((event == EVT_CONTROL_CHANGE) && (channel == LKM_CHANNEL_POTS) && (key >= LKM_POT_LOW) && (key <= LKM_POT_HIGH)) {
      // Drum pads color changing sequence
      if ((key == LKM_POT_LOW) && (changeDrumPadColorState == 3)) {
         for (i = LKM_DRUM_PADS_LOW; i <= LKM_DRUM_PADS_HIGH; i++) {
            host.getMidiOutPort(1).sendMidi(0x99, i, value);
         }
      }

      // Volume changing
      if ((currentMode == modeEnum.CUSTOM) || (currentMode == modeEnum.CUSTOM_SELECT)) {
         var index = key - LKM_POT_LOW;
         trackBank.getItemAt(index).volume().set(value, 128);
      }
   }
}

function onSysex0(data) {
   // MMC Transport Controls:
   switch (data) {
      case "f07f7f0605f7":
         transport.rewind();
         break;
      case "f07f7f0604f7":
         transport.fastForward();
         break;
      case "f07f7f0601f7":
         transport.stop();
         break;
      case "f07f7f0602f7":
         transport.play();
         break;
      case "f07f7f0606f7":
         transport.record();
         break;
   }
}

//
// MIDI0 event
//
function onMidi1(status, data1, data2) {
   // Extract event and channel
   var event = (status & 0xF0) >>> 4;
   var channel = status & 0x0F;
   var key = data1 & 0x7F;
   var value = data2 & 0x7F;

   // Debug
   printMidi(status, data1, data2);
   println("Slot 1 | E=" + event.toString(16) + " C=" + channel.toString(16) + " K=" + key.toString(16) + " V=" + value.toString(16));

   // Mode change buttons
   if ((event == EVT_CONTROL_CHANGE) && (channel == LKM_CHANNEL_MODE) && (key == LKM_BUTTON_MODE)) {
      if (value == LKM_MODE_DRUMS) {
         currentMode = modeEnum.DRUMS;
      } else if (value == LKM_MODE_CUSTOM) {
         currentMode = modeEnum.CUSTOM;
      }
      updateCustomModeColors();
   }
}

function onSysex1(data) {
}