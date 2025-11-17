// Clean-Cut ExtendScript Host Functions
// This file contains ALL functions that interact with Premiere Pro's API
// Consolidated from multiple modules to avoid #include path resolution issues

// ==============================================================================
// POLYFILLS AND UTILITIES
// ==============================================================================

// Add polyfill for Object.keys (ExtendScript doesn't have it)
if (!Object.keys) {
  Object.keys = function (obj) {
    if (obj !== Object(obj)) {
      throw new TypeError('Object.keys called on a non-object')
    }
    var keys = []
    for (var p in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, p)) {
        keys.push(p)
      }
    }
    return keys
  }
}

// Add JSON polyfill for ExtendScript (ES3)
if (typeof JSON === 'undefined') {
  JSON = {
    stringify: function (obj) {
      // Handle null and undefined
      if (obj === null) return 'null'
      if (obj === undefined) return undefined

      // Handle primitives
      var t = typeof obj
      if (t === 'string')
        return (
          '"' +
          obj
            .replace(/["\\]/g, '\\$&')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t') +
          '"'
        )
      if (t === 'number' || t === 'boolean') return String(obj)

      // Handle arrays
      if (obj instanceof Array) {
        var arr = []
        for (var i = 0; i < obj.length; i++) {
          arr.push(JSON.stringify(obj[i]))
        }
        return '[' + arr.join(',') + ']'
      }

      // Handle objects
      if (t === 'object') {
        var pairs = []
        for (var k in obj) {
          if (obj.hasOwnProperty(k)) {
            pairs.push(JSON.stringify(k) + ':' + JSON.stringify(obj[k]))
          }
        }
        return '{' + pairs.join(',') + '}'
      }

      return '{}'
    },

    parse: function (str) {
      return eval('(' + str + ')')
    }
  }
}

// Add polyfill for Array.indexOf (ExtendScript doesn't have it)
if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function (searchElement, fromIndex) {
    if (this === null || this === undefined) {
      throw new TypeError('Array.prototype.indexOf called on null or undefined')
    }
    var arr = Object(this)
    var len = arr.length >>> 0
    if (len === 0) return -1

    var n = fromIndex | 0
    if (n >= len) return -1

    var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0)
    while (k < len) {
      if (k in arr && arr[k] === searchElement) {
        return k
      }
      k++
    }
    return -1
  }
}

/**
 * Helper function to log messages to the Premiere Pro console
 * @param {string} message - Message to log
 */
function logMessage(message) {
  try {
    $.writeln('[Clean-Cut] ' + message)
  } catch (e) {
    // Silent fail if console logging isn't available
  }
}

/**
 * Test function to verify script loads correctly
 * @returns {string} JSON string with success status
 */
function testConnection() {
  try {
    var result = {
      success: true,
      message: 'Host script loaded successfully',
      timestamp: new Date().getTime(),
      version: '2.0-consolidated'
    }
    return JSON.stringify(result)
  } catch (e) {
    return 'ERROR in testConnection: ' + e.toString() + ' | Line: ' + (e.line || 'unknown')
  }
}

/**
 * Ultra simple test - no JSON
 */
function test1() {
  return 'test1 works'
}

/**
 * Simple JSON test
 */
function test2() {
  try {
    return JSON.stringify({ test: 'test2' })
  } catch (e) {
    return 'ERROR in test2: ' + e.toString()
  }
}

/**
 * Test with Date
 */
function test3() {
  try {
    var x = new Date().getTime()
    return JSON.stringify({ time: x })
  } catch (e) {
    return 'ERROR in test3: ' + e.toString()
  }
}

// ==============================================================================
// PRESET MANAGEMENT MODULE
// ==============================================================================

// ==== EMBEDDED PRESET DATA ====
// This is the complete XML content of the "Waveform Audio 48kHz 16-bit.epr" preset

var EMBEDDED_PRESET_XML =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<PremiereData Version="3">' +
  '	<StandardFilters Version="1">' +
  '		<DeinterlaceState>false</DeinterlaceState>' +
  '		<CropType>0</CropType>' +
  '		<CropRect>0,0,0,0</CropRect>' +
  '		<CropState>false</CropState>' +
  '	</StandardFilters>' +
  '	<DoEmulation>true</DoEmulation>' +
  '	<DoVideo>false</DoVideo>' +
  '	<DoAudio>true</DoAudio>' +
  '	<PresetID>f9d77413-d97c-457b-9640-72e9844e2cde</PresetID>' +
  '	<PostProcParamContainer ObjectRef="21"/>' +
  '	<FilterParamContainer ObjectRef="14"/>' +
  '	<ExportParamContainer ObjectRef="1"/>' +
  '	<ExporterFileType>1463899717</ExporterFileType>' +
  '	<ExporterClassID>1061109567</ExporterClassID>' +
  '	<ExporterName></ExporterName>' +
  '	<PresetName>($$$/AME/EncoderHost/Presets/f9d77413-d97c-457b-9640-72e9844e2cde/PresetName=WAV 48 kHz 16-bit)</PresetName>' +
  '	<FolderDisplayPath>System Presets/Audio Only</FolderDisplayPath>' +
  '	<ExporterParamContainer ObjectID="1" ClassID="5c20a4a5-5e7c-4032-85b8-26ad4531fe7b" Version="1">' +
  '		<ContainedParamsVersion>1</ContainedParamsVersion>' +
  '		<ParamContainerItems Version="1">' +
  '			<ParamContainerItem Index="0" ObjectRef="2"/>' +
  '		</ParamContainerItems>' +
  '	</ExporterParamContainer>' +
  '	<ExporterParam ObjectID="2" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamTargetBitrate>0</ParamTargetBitrate>' +
  '		<ParamTargetID>0</ParamTargetID>' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ExporterChildParams ObjectRef="3"/>' +
  '		<ParamName></ParamName>' +
  '		<ParamIdentifier>0</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>false</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>0</ParamOrdinalValue>' +
  '		<ParamType>10</ParamType>' +
  '		<ParamValue>0</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParamContainer ObjectID="3" ClassID="5c20a4a5-5e7c-4032-85b8-26ad4531fe7b" Version="1">' +
  '		<ContainedParamsVersion>1</ContainedParamsVersion>' +
  '		<ParamContainerItems Version="1">' +
  '			<ParamContainerItem Index="0" ObjectRef="4"/>' +
  '		</ParamContainerItems>' +
  '	</ExporterParamContainer>' +
  '	<ExporterParam ObjectID="4" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ExporterChildParams ObjectRef="5"/>' +
  '		<ParamIdentifier>ADBEAudioTabGroup</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>false</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>0</ParamOrdinalValue>' +
  '		<ParamType>8</ParamType>' +
  '		<ParamValue>0</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParamContainer ObjectID="5" ClassID="5c20a4a5-5e7c-4032-85b8-26ad4531fe7b" Version="1">' +
  '		<ContainedParamsVersion>1</ContainedParamsVersion>' +
  '		<ParamContainerItems Version="1">' +
  '			<ParamContainerItem Index="0" ObjectRef="6"/>' +
  '			<ParamContainerItem Index="1" ObjectRef="9"/>' +
  '		</ParamContainerItems>' +
  '	</ExporterParamContainer>' +
  '	<ExporterParam ObjectID="6" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ExporterChildParams ObjectRef="7"/>' +
  '		<ParamIdentifier>ADBEAudioCodecGroup</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>false</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>0</ParamOrdinalValue>' +
  '		<ParamType>8</ParamType>' +
  '		<ParamValue>0</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParamContainer ObjectID="7" ClassID="5c20a4a5-5e7c-4032-85b8-26ad4531fe7b" Version="1">' +
  '		<ContainedParamsVersion>1</ContainedParamsVersion>' +
  '		<ParamContainerItems Version="1">' +
  '			<ParamContainerItem Index="0" ObjectRef="8"/>' +
  '		</ParamContainerItems>' +
  '	</ExporterParamContainer>' +
  '	<ExporterParam ObjectID="8" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ParamIdentifier>ADBEAudioCodec</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>true</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>0</ParamOrdinalValue>' +
  '		<ParamType>2</ParamType>' +
  '		<ParamValue>0</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParam ObjectID="9" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ExporterChildParams ObjectRef="10"/>' +
  '		<ParamIdentifier>ADBEBasicAudioGroup</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>false</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>1</ParamOrdinalValue>' +
  '		<ParamType>8</ParamType>' +
  '		<ParamValue>0</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParamContainer ObjectID="10" ClassID="5c20a4a5-5e7c-4032-85b8-26ad4531fe7b" Version="1">' +
  '		<ContainedParamsVersion>1</ContainedParamsVersion>' +
  '		<ParamContainerItems Version="1">' +
  '			<ParamContainerItem Index="0" ObjectRef="11"/>' +
  '			<ParamContainerItem Index="1" ObjectRef="12"/>' +
  '			<ParamContainerItem Index="2" ObjectRef="13"/>' +
  '		</ParamContainerItems>' +
  '	</ExporterParamContainer>' +
  '	<ExporterParam ObjectID="11" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ParamIdentifier>ADBEAudioRatePerSecond</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>true</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>0</ParamOrdinalValue>' +
  '		<ParamType>2</ParamType>' +
  '		<ParamValue>48000</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParam ObjectID="12" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ParamIdentifier>ADBEAudioNumChannels</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>true</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>1</ParamOrdinalValue>' +
  '		<ParamType>2</ParamType>' +
  '		<ParamValue>2</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParam ObjectID="13" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ParamIdentifier>ADBEAudioSampleType</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>true</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>2</ParamOrdinalValue>' +
  '		<ParamType>2</ParamType>' +
  '		<ParamValue>1</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParamContainer ObjectID="14" ClassID="5c20a4a5-5e7c-4032-85b8-26ad4531fe7b" Version="1">' +
  '		<ContainedParamsVersion>1</ContainedParamsVersion>' +
  '		<ParamContainerItems Version="1">' +
  '			<ParamContainerItem Index="0" ObjectRef="15"/>' +
  '		</ParamContainerItems>' +
  '	</ExporterParamContainer>' +
  '	<ExporterParam ObjectID="15" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamTargetBitrate>0</ParamTargetBitrate>' +
  '		<ParamTargetID>0</ParamTargetID>' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ExporterChildParams ObjectRef="16"/>' +
  '		<ParamName>Filters</ParamName>' +
  '		<ParamIdentifier>FiltersParamsMultiGroup</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>false</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>0</ParamOrdinalValue>' +
  '		<ParamType>10</ParamType>' +
  '		<ParamValue>0</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParamContainer ObjectID="16" ClassID="5c20a4a5-5e7c-4032-85b8-26ad4531fe7b" Version="1">' +
  '		<ContainedParamsVersion>1</ContainedParamsVersion>' +
  '		<ParamContainerItems Version="1">' +
  '			<ParamContainerItem Index="0" ObjectRef="17"/>' +
  '		</ParamContainerItems>' +
  '	</ExporterParamContainer>' +
  '	<ExporterParam ObjectID="17" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ExporterChildParams ObjectRef="18"/>' +
  '		<ParamIdentifier>GuasianBlurFilterGroup</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>true</ParamIsDisabled>' +
  '		<ParamIsIndependant>false</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>0</ParamOrdinalValue>' +
  '		<ParamType>8</ParamType>' +
  '		<ParamValue>0</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParamContainer ObjectID="18" ClassID="5c20a4a5-5e7c-4032-85b8-26ad4531fe7b" Version="1">' +
  '		<ContainedParamsVersion>1</ContainedParamsVersion>' +
  '		<ParamContainerItems Version="1">' +
  '			<ParamContainerItem Index="0" ObjectRef="19"/>' +
  '			<ParamContainerItem Index="1" ObjectRef="20"/>' +
  '		</ParamContainerItems>' +
  '	</ExporterParamContainer>' +
  '	<ExporterParam ObjectID="19" ClassID="018cf63d-c58d-4d39-97df-36b6b2d6ef88" Version="1">' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ParamIdentifier>GuasianBlurFilterGroup_Blurriness</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>false</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>0</ParamOrdinalValue>' +
  '		<ParamType>3</ParamType>' +
  '		<ParamValue>0.</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParam ObjectID="20" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ParamIdentifier>GuasianBlurFilterGroup_BlurDimension</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>false</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>1</ParamOrdinalValue>' +
  '		<ParamType>2</ParamType>' +
  '		<ParamValue>0</ParamValue>' +
  '	</ExporterParam>' +
  '	<ExporterParamContainer ObjectID="21" ClassID="5c20a4a5-5e7c-4032-85b8-26ad4531fe7b" Version="1">' +
  '		<ContainedParamsVersion>1</ContainedParamsVersion>' +
  '		<ParamContainerItems Version="1">' +
  '			<ParamContainerItem Index="0" ObjectRef="22"/>' +
  '		</ParamContainerItems>' +
  '	</ExporterParamContainer>' +
  '	<ExporterParam ObjectID="22" ClassID="9f049ab7-d48f-43e9-a8ca-4d7f21233625" Version="1">' +
  '		<ParamTargetBitrate>0</ParamTargetBitrate>' +
  '		<ParamTargetID>0</ParamTargetID>' +
  '		<ParamAuxType></ParamAuxType>' +
  '		<ParamAuxValue></ParamAuxValue>' +
  '		<ParamName>Others</ParamName>' +
  '		<ParamIdentifier>PostEncodeHostMultiGroup</ParamIdentifier>' +
  '		<ParamConstrainedListIsOptional>false</ParamConstrainedListIsOptional>' +
  '		<IsFilePathString>false</IsFilePathString>' +
  '		<IsOptionalParamEnabled>false</IsOptionalParamEnabled>' +
  '		<IsOptionalParam>false</IsOptionalParam>' +
  '		<IsParamPairGroup>false</IsParamPairGroup>' +
  '		<ParamIsPassword>false</ParamIsPassword>' +
  '		<ParamIsMultiLine>false</ParamIsMultiLine>' +
  '		<ParamIsHidden>false</ParamIsHidden>' +
  '		<ParamIsDisabled>false</ParamIsDisabled>' +
  '		<ParamIsIndependant>false</ParamIsIndependant>' +
  '		<ParamIsSlider>false</ParamIsSlider>' +
  '		<ParamDontSerializeValue>false</ParamDontSerializeValue>' +
  '		<ParamOrdinalValue>0</ParamOrdinalValue>' +
  '		<ParamType>10</ParamType>' +
  '		<ParamValue>0</ParamValue>' +
  '	</ExporterParam>' +
  '</PremiereData>'

/**
 * Creates a temporary preset file from the embedded XML data
 * @returns {string} Path to temporary preset file or null if failed
 */
function createTempPresetFromEmbedded(outputFolder) {
  try {
    // Generate unique temporary filename
    var timestamp = new Date().getTime()
    var tempFileName = 'clean_cut_preset_' + timestamp + '.epr'

    // Use provided output folder or fallback to system temp
    var tempFilePath
    if (outputFolder && outputFolder.length > 0) {
      // Use the same directory as audio exports for consistency
      tempFilePath = outputFolder + '/' + tempFileName
    } else {
      // Fallback to system temp directory for backward compatibility
      tempFilePath = Folder.temp.fsName + '/' + tempFileName
    }

    // Write the XML content to temporary file
    var tempFile = new File(tempFilePath)
    tempFile.open('w')
    tempFile.write(EMBEDDED_PRESET_XML)
    tempFile.close()

    if (tempFile.exists) {
      return tempFilePath
    } else {
      return null
    }
  } catch (e) {
    return null
  }
}

/**
 * Gets the path to the preset file using embedded data
 * @param {string} outputFolder - Optional output folder to use for preset file
 * @returns {object} Object with path and debug info
 */
function getPresetFilePath(outputFolder) {
  try {
    // Use embedded preset data instead of external file
    var tempPresetPath = createTempPresetFromEmbedded(outputFolder)

    return {
      path: tempPresetPath,
      debug: {
        method: 'embedded',
        fileName: $.fileName,
        tempPresetPath: tempPresetPath,
        outputFolder: outputFolder || 'system temp',
        success: tempPresetPath !== null
      }
    }
  } catch (e) {
    return {
      path: null,
      debug: {
        error: e.toString(),
        fileName: $.fileName,
        method: 'embedded',
        outputFolder: outputFolder || 'system temp'
      }
    }
  }
}

// ==============================================================================
// SEQUENCE INFORMATION MODULE
// ==============================================================================

/**
 * Returns the current status of the Premiere Pro connection
 * @returns {string} JSON string with status information
 */
function getPremiereStatus() {
  try {
    return JSON.stringify({
      status: 'connected',
      version: '1.0',
      premiereVersion: app.version || 'unknown',
      projectName: app.project ? app.project.name : 'no project',
      activeSequence:
        app.project && app.project.activeSequence ? app.project.activeSequence.name : 'none'
    })
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      version: '1.0',
      error: error.toString()
    })
  }
}

/**
 * Returns detailed information about the active sequence
 * @returns {string} JSON string with sequence information
 */
function getActiveSequenceInfo() {
  try {
    // Check if there's an active project and sequence
    if (!app.project || !app.project.activeSequence) {
      return JSON.stringify({
        success: false,
        error: 'No active sequence',
        hasActiveSequence: false
      })
    }

    var sequence = app.project.activeSequence
    var timebase = parseFloat(sequence.timebase)

    // Get basic sequence info
    var sequenceInfo = {
      success: true,
      hasActiveSequence: true,
      sequenceName: sequence.name || 'Untitled Sequence',
      projectName: app.project.name || 'Untitled Project',
      frameRate: 'N/A',
      duration: 0,
      durationSeconds: 0,
      durationTime: null,
      endTime: 'N/A',
      // In/Out points (regular methods)
      inPoint: 0,
      outPoint: 0,
      // In/Out points (as time objects)
      inPointTime: null,
      outPointTime: null,
      inPointTicks: null,
      outPointTicks: null,
      // Simple counts for main display
      videoTracks: 0,
      audioTracks: 0,
      // Detailed arrays for details section
      videoTrackInfo: [],
      audioTrackInfo: [],
      selectedClips: []
    }

    // Get frame rate using videoDisplayFormat
    try {
      var videoDisplayFormat = sequence.videoDisplayFormat
      var frameRateMap = {
        100: '24',
        101: '25',
        102: '29.97 Drop',
        103: '29.97 Non-Drop',
        104: '30',
        105: '50',
        106: '59.94 Drop',
        107: '59.94 Non-Drop',
        108: '60',
        109: 'Frames',
        110: '23.976',
        111: '16mm Feet + Frames',
        112: '35mm Feet + Frames',
        113: '48'
      }
      sequenceInfo.frameRate =
        frameRateMap[videoDisplayFormat] || 'Unknown (' + videoDisplayFormat + ')'
    } catch (e) {
      sequenceInfo.frameRate = 'N/A'
    }

    // Get duration information
    try {
      if (sequence.end) {
        // According to documentation, sequence.end is already a string of ticks
        var endTicks = parseFloat(sequence.end)
        // Convert from ticks to seconds using the correct conversion
        // There are 254016000000 ticks per second according to Time object documentation
        var ticksPerSecond = 254016000000
        sequenceInfo.duration = endTicks / ticksPerSecond
        sequenceInfo.durationSeconds = sequenceInfo.duration
        sequenceInfo.endTime = sequenceInfo.duration.toFixed(2) + 's'

        // Create formatted duration time using Time object
        try {
          var durationTimeObj = new Time()
          durationTimeObj.ticks = endTicks.toString()

          // Create frame rate Time object for formatting
          var frameRateTime = new Time()
          frameRateTime.ticks = sequence.timebase.toString()

          // Use the sequence's video display format for consistent formatting
          var displayFormat = sequence.videoDisplayFormat || 103 // Default to 29.97 Non-Drop

          sequenceInfo.durationTime = durationTimeObj.getFormatted(frameRateTime, displayFormat)
        } catch (formatError) {
          sequenceInfo.durationTime = null
        }
      }
    } catch (e) {
      // Use defaults
    }

    // Get in/out points (both regular and as time objects)
    try {
      // Regular in/out points (likely in seconds)
      sequenceInfo.inPoint = parseFloat(sequence.getInPoint()) || 0
      sequenceInfo.outPoint = parseFloat(sequence.getOutPoint()) || sequenceInfo.duration

      // Time objects for more detailed timing information
      try {
        var inPointTime = sequence.getInPointAsTime()
        var outPointTime = sequence.getOutPointAsTime()

        // Convert Time objects to timecode format using getFormatted()
        if (inPointTime && outPointTime) {
          // Create frame rate Time object for formatting
          var frameRateTime = new Time()
          frameRateTime.ticks = sequence.timebase.toString()

          // Use the sequence's video display format for consistent formatting
          var displayFormat = sequence.videoDisplayFormat || 103 // Default to 29.97 Non-Drop

          sequenceInfo.inPointTime = inPointTime.getFormatted(frameRateTime, displayFormat)
          sequenceInfo.outPointTime = outPointTime.getFormatted(frameRateTime, displayFormat)
        } else {
          sequenceInfo.inPointTime = null
          sequenceInfo.outPointTime = null
        }

        // Also get the raw time values if available
        sequenceInfo.inPointTicks = inPointTime && inPointTime.ticks ? inPointTime.ticks : null
        sequenceInfo.outPointTicks = outPointTime && outPointTime.ticks ? outPointTime.ticks : null
      } catch (timeError) {
        // Time objects not available - use null values
        sequenceInfo.inPointTime = null
        sequenceInfo.outPointTime = null
        sequenceInfo.inPointTicks = null
        sequenceInfo.outPointTicks = null
      }
    } catch (e) {
      // Use defaults if methods fail
      sequenceInfo.inPoint = 0
      sequenceInfo.outPoint = sequenceInfo.duration
      sequenceInfo.inPointTime = null
      sequenceInfo.outPointTime = null
      sequenceInfo.inPointTicks = null
      sequenceInfo.outPointTicks = null
    }

    // Get audio track info
    try {
      if (sequence.audioTracks && sequence.audioTracks.numTracks) {
        for (var i = 0; i < sequence.audioTracks.numTracks; i++) {
          var track = sequence.audioTracks[i]
          sequenceInfo.audioTracks += 1
          sequenceInfo.audioTrackInfo.push({
            index: i + 1,
            name: track.name || 'Audio ' + (i + 1),
            enabled: true
          })
        }
      }
    } catch (e) {
      // Use empty array
    }

    // Get video track info
    try {
      if (sequence.videoTracks && sequence.videoTracks.numTracks) {
        for (var i = 0; i < sequence.videoTracks.numTracks; i++) {
          var track = sequence.videoTracks[i]
          sequenceInfo.videoTracks += 1
          sequenceInfo.videoTrackInfo.push({
            index: i + 1,
            name: track.name || 'Video ' + (i + 1),
            enabled: true
          })
        }
      }
    } catch (e) {
      // Use empty array
    }

    // Get selected clips using getSelection() method
    try {
      var selection = sequence.getSelection()
      if (selection && selection.length > 0) {
        for (var i = 0; i < selection.length; i++) {
          var clip = selection[i]
          try {
            var clipInfo = {
              name: clip.name || 'Unknown Clip',
              mediaType: clip.mediaType || 'Unknown',
              start: 0,
              end: 0,
              duration: 0,
              startTime: null,
              endTime: null,
              trackIndex: -1
            }

            // Get timing information if available
            if (clip.start && clip.end) {
              var ticksPerSecond = 254016000000
              clipInfo.start = parseFloat(clip.start.ticks) / ticksPerSecond
              clipInfo.end = parseFloat(clip.end.ticks) / ticksPerSecond
              clipInfo.duration = clipInfo.end - clipInfo.start

              // Create formatted timecode for start and end times
              try {
                var startTimeObj = new Time()
                startTimeObj.ticks = clip.start.ticks
                var endTimeObj = new Time()
                endTimeObj.ticks = clip.end.ticks

                // Create frame rate Time object for formatting
                var frameRateTime = new Time()
                frameRateTime.ticks = sequence.timebase.toString()

                // Use the sequence's video display format for consistent formatting
                var displayFormat = sequence.videoDisplayFormat || 103 // Default to 29.97 Non-Drop

                clipInfo.startTime = startTimeObj.getFormatted(frameRateTime, displayFormat)
                clipInfo.endTime = endTimeObj.getFormatted(frameRateTime, displayFormat)
              } catch (formatError) {
                clipInfo.startTime = null
                clipInfo.endTime = null
              }
            }

            sequenceInfo.selectedClips.push(clipInfo)
          } catch (clipError) {
            // Skip invalid clips
          }
        }
      }
    } catch (e) {
      // Use empty array if selection fails
    }

    return JSON.stringify(sequenceInfo)
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Error getting sequence info: ' + error.toString(),
      hasActiveSequence: false
    })
  }
}

/**
 * Gets information about selected clips in the active sequence
 * @returns {string} JSON string with selected clips information
 */
function getSelectedClipsInfo() {
  try {
    if (!app.project || !app.project.activeSequence) {
      return JSON.stringify({
        success: false,
        error: 'No active sequence',
        hasSelectedClips: false
      })
    }

    var sequence = app.project.activeSequence
    var selectedClips = []
    var selectedClipsFound = 0

    logMessage('Analyzing selected clips across all tracks...')

    // Check video tracks
    for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
      var videoTrack = sequence.videoTracks[v]
      for (var vc = 0; vc < videoTrack.clips.numItems; vc++) {
        var clip = videoTrack.clips[vc]
        if (clip && clip.isSelected()) {
          selectedClipsFound++

          var clipInfo = {
            trackIndex: v + 1,
            clipName: clip.name || 'Unknown Video Clip',
            startTime: parseFloat(clip.start.seconds),
            endTime: parseFloat(clip.end.seconds),
            duration: parseFloat(clip.end.seconds) - parseFloat(clip.start.seconds),
            type: 'video'
          }

          selectedClips.push(clipInfo)
          logMessage(
            'Selected video clip on track ' +
              (v + 1) +
              ': ' +
              clipInfo.startTime +
              's to ' +
              clipInfo.endTime +
              's'
          )
        }
      }
    }

    // Check audio tracks
    for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
      var audioTrack = sequence.audioTracks[a]
      for (var ac = 0; ac < audioTrack.clips.numItems; ac++) {
        var clip = audioTrack.clips[ac]
        if (clip && clip.isSelected()) {
          selectedClipsFound++

          var clipInfo = {
            trackIndex: a + 1,
            clipName: clip.name || 'Unknown Audio Clip',
            startTime: parseFloat(clip.start.seconds),
            endTime: parseFloat(clip.end.seconds),
            duration: parseFloat(clip.end.seconds) - parseFloat(clip.start.seconds),
            type: 'audio'
          }

          selectedClips.push(clipInfo)
          logMessage(
            'Selected audio clip on track ' +
              (a + 1) +
              ': ' +
              clipInfo.startTime +
              's to ' +
              clipInfo.endTime +
              's'
          )
        }
      }
    }

    logMessage('Found ' + selectedClipsFound + ' selected clips total')

    return JSON.stringify({
      success: true,
      selectedClips: selectedClips,
      hasSelectedClips: selectedClipsFound > 0
    })
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Error getting selected clips: ' + error.toString(),
      selectedClips: [],
      hasSelectedClips: false
    })
  }
}
// ==============================================================================
// CLIP MANAGEMENT MODULE
// ==============================================================================

/**
 * Gets the time range of selected clips across all tracks
 * @param {object} sequence - The active sequence
 * @returns {object} Object with success, startTime, endTime, and error properties
 */
function getSelectedClipsTimeRange(sequence) {
  try {
    var earliestStart = Number.MAX_VALUE
    var latestEnd = 0
    var selectedClipsFound = 0

    logMessage('Analyzing selected clips across all tracks...')

    // Check video tracks
    for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
      var videoTrack = sequence.videoTracks[v]
      for (var vc = 0; vc < videoTrack.clips.numItems; vc++) {
        var clip = videoTrack.clips[vc]
        if (clip && clip.isSelected()) {
          selectedClipsFound++
          var startTime = parseFloat(clip.start.seconds)
          var endTime = parseFloat(clip.end.seconds)

          if (startTime < earliestStart) {
            earliestStart = startTime
          }
          if (endTime > latestEnd) {
            latestEnd = endTime
          }

          logMessage(
            'Selected video clip on track ' + (v + 1) + ': ' + startTime + 's to ' + endTime + 's'
          )
        }
      }
    }

    // Check audio tracks
    for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
      var audioTrack = sequence.audioTracks[a]
      for (var ac = 0; ac < audioTrack.clips.numItems; ac++) {
        var clip = audioTrack.clips[ac]
        if (clip && clip.isSelected()) {
          selectedClipsFound++
          var startTime = parseFloat(clip.start.seconds)
          var endTime = parseFloat(clip.end.seconds)

          if (startTime < earliestStart) {
            earliestStart = startTime
          }
          if (endTime > latestEnd) {
            latestEnd = endTime
          }

          logMessage(
            'Selected audio clip on track ' + (a + 1) + ': ' + startTime + 's to ' + endTime + 's'
          )
        }
      }
    }

    if (selectedClipsFound === 0) {
      return {
        success: false,
        error: 'No clips are currently selected'
      }
    }

    logMessage('Found ' + selectedClipsFound + ' selected clips total')
    logMessage('Combined range: ' + earliestStart + 's to ' + latestEnd + 's')

    return {
      success: true,
      startTime: earliestStart,
      endTime: latestEnd,
      clipCount: selectedClipsFound
    }
  } catch (error) {
    return {
      success: false,
      error: 'Error analyzing selected clips: ' + error.toString()
    }
  }
}

/**
 * Helper function to find all selected clips across video and audio tracks
 * @returns {Array} Array of selected clip objects with track info
 */
function findSelectedClips() {
  var sequence = app.project.activeSequence
  if (!sequence) return []

  var selectedClips = []

  // Check video tracks
  for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
    var videoTrack = sequence.videoTracks[v]
    for (var vc = 0; vc < videoTrack.clips.numItems; vc++) {
      var clip = videoTrack.clips[vc]
      if (clip && clip.isSelected()) {
        selectedClips.push({
          clip: clip,
          trackIndex: v,
          clipIndex: vc,
          isVideo: true,
          name: clip.name,
          startTime: parseFloat(clip.start.seconds),
          endTime: parseFloat(clip.end.seconds)
        })
      }
    }
  }

  // Check audio tracks
  for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
    var audioTrack = sequence.audioTracks[a]
    for (var ac = 0; ac < audioTrack.clips.numItems; ac++) {
      var clip = audioTrack.clips[ac]
      if (clip && clip.isSelected()) {
        selectedClips.push({
          clip: clip,
          trackIndex: a,
          clipIndex: ac,
          isVideo: false,
          name: clip.name,
          startTime: parseFloat(clip.start.seconds),
          endTime: parseFloat(clip.end.seconds)
        })
      }
    }
  }

  return selectedClips
}
/**
 * Properly deletes a clip without falling back to opacity changes
 * @param {number} trackIndex - Index of the track
 * @param {number} clipIndex - Index of the clip in the track
 * @param {boolean} isVideo - Whether this is a video track
 * @param {boolean} ripple - Whether to use ripple delete
 * @returns {object} Result object with success status and method used
 */
function properDeleteClip(trackIndex, clipIndex, isVideo, ripple) {
  var results = {
    success: false,
    error: 'All deletion methods failed',
    methods: []
  }

  // Method 1: Try official trackItem.remove() method (Premiere Pro 13.1+)
  try {
    var sequence = app.project.activeSequence
    if (sequence) {
      var track = isVideo ? sequence.videoTracks[trackIndex] : sequence.audioTracks[trackIndex]

      if (track && clipIndex < track.clips.numItems) {
        var clip = track.clips[clipIndex]

        // Use the official remove method
        var removeResult = clip.remove(ripple, true)

        if (removeResult === 0) {
          results.success = true
          results.method = 'trackItem.remove()'
          results.methods.push('trackItem.remove() - Success')
          return results
        } else {
          results.methods.push('trackItem.remove() - Returned: ' + removeResult)
        }
      }
    }
  } catch (removeError) {
    results.methods.push('trackItem.remove() - Failed: ' + removeError.toString())
  }

  // Method 2: Try QE DOM approach (more reliable than the old fallback)
  try {
    if (app.enableQE() !== false) {
      var qeSequence = qe.project.getActiveSequence()
      var qeTrack = isVideo
        ? qeSequence.getVideoTrackAt(trackIndex)
        : qeSequence.getAudioTrackAt(trackIndex)

      if (qeTrack && qeTrack.numItems > clipIndex) {
        var qeClip = qeTrack.getItemAt(clipIndex)
        if (qeClip) {
          qeClip.remove(ripple, true)
          results.success = true
          results.method = 'QE DOM'
          results.methods.push('QE DOM - Success')
          return results
        }
      }
    }
  } catch (qeError) {
    results.methods.push('QE DOM - Failed: ' + qeError.toString())
  }

  // Method 3: Try selection and delete (last resort)
  try {
    var sequence = app.project.activeSequence
    if (sequence) {
      var track = isVideo ? sequence.videoTracks[trackIndex] : sequence.audioTracks[trackIndex]

      if (track && clipIndex < track.clips.numItems) {
        var clip = track.clips[clipIndex]

        // Select the clip
        clip.isSelected = true

        // Try to delete selected clips
        if (ripple) {
          sequence.deleteSelection() // This should ripple delete
        } else {
          sequence.deleteSelection() // This should delete with gap
        }

        results.success = true
        results.method = 'selection.delete()'
        results.methods.push('Selection delete - Success')
        return results
      }
    }
  } catch (selectionError) {
    results.methods.push('Selection delete - Failed: ' + selectionError.toString())
  }

  // DO NOT fall back to opacity changes - we want actual deletion
  results.error = 'All deletion methods failed: ' + results.methods.join(', ')
  return results
}

/**
 * Identifies and deletes silence segments based on audio level analysis
 * @param {string} segmentsJSON - JSON string of silence segments with start/end times
 * @returns {string} JSON string with operation result
 */
function deleteSilenceSegments(segmentsJSON) {
  try {
    var sequence = app.project.activeSequence
    if (!sequence) {
      return JSON.stringify({ success: false, error: 'No active sequence' })
    }

    var segments
    try {
      segments = JSON.parse(segmentsJSON)
    } catch (parseError) {
      return JSON.stringify({
        success: false,
        error: 'Invalid segments JSON: ' + parseError.toString()
      })
    }

    if (!segments || segments.length === 0) {
      return JSON.stringify({
        success: false,
        error: 'No silence segments provided'
      })
    }

    logMessage('Identifying and deleting silence clips...')
    logMessage('Segments to delete: ' + segments.length)

    var tolerance = 0.15 // 150ms tolerance for time matching (increased for post-cut precision)
    var clipsDeleted = 0
    var totalClipsFound = 0
    var results = []
    var errors = []

    // Sort segments by start time (latest first) to prevent index shifting during deletion
    segments.sort(function (a, b) {
      return b.start - a.start
    })

    // Process each segment: find and delete clips immediately
    for (var s = 0; s < segments.length; s++) {
      var segment = segments[s]
      var segmentStart = segment.start
      var segmentEnd = segment.end
      var segmentDuration = segmentEnd - segmentStart

      logMessage(
        'Processing silence segment ' +
          (s + 1) +
          '/' +
          segments.length +
          ': ' +
          segmentStart +
          's to ' +
          segmentEnd +
          's (duration: ' +
          segmentDuration +
          's)'
      )

      // Only process segments that are likely to be silence (longer than 100ms)
      if (segmentDuration < 0.1) {
        logMessage('Skipping very short segment (< 100ms)')
        continue
      }

      var clipsToDeleteNow = []

      // Check audio tracks first (silence detection is primarily audio-based)
      for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
        var audioTrack = sequence.audioTracks[a]

        for (var ac = 0; ac < audioTrack.clips.numItems; ac++) {
          var clip = audioTrack.clips[ac]
          if (clip) {
            var clipStart = parseFloat(clip.start.seconds)
            var clipEnd = parseFloat(clip.end.seconds)
            var clipDuration = clipEnd - clipStart

            // Improved matching: Check multiple conditions
            var startsNearSegmentStart = Math.abs(clipStart - segmentStart) < tolerance
            var endsNearSegmentEnd = Math.abs(clipEnd - segmentEnd) < tolerance
            var durationMatches = Math.abs(clipDuration - segmentDuration) < tolerance

            // Also check if clip is contained within the silence segment (for clips slightly inside)
            var isContainedInSegment =
              clipStart >= segmentStart - tolerance && clipEnd <= segmentEnd + tolerance

            // Check if all three match OR if clip is contained in segment
            var isMatch =
              (startsNearSegmentStart && endsNearSegmentEnd && durationMatches) ||
              isContainedInSegment

            // Debug logging for clips near the target area
            if (
              clipStart >= segmentStart - 1.0 &&
              clipStart <= segmentStart + 1.0 &&
              clipDuration < segmentDuration + 1.0
            ) {
              logMessage(
                '  Checking clip: ' +
                  clipStart +
                  's to ' +
                  clipEnd +
                  's (dur: ' +
                  clipDuration +
                  's)'
              )
              logMessage('    Start diff: ' + Math.abs(clipStart - segmentStart).toFixed(3) + 's')
              logMessage('    End diff: ' + Math.abs(clipEnd - segmentEnd).toFixed(3) + 's')
              logMessage(
                '    Duration diff: ' + Math.abs(clipDuration - segmentDuration).toFixed(3) + 's'
              )
              logMessage('    Match result: ' + isMatch)
            }

            if (isMatch) {
              // Additional check: ensure this is likely a silence segment
              // by checking if it's in the middle of what was originally a longer clip
              var isLikelySilence = true

              // If the clip is very short compared to typical speech, it's likely silence
              if (clipDuration < 0.5) {
                isLikelySilence = true
              }

              if (isLikelySilence) {
                // Mark this clip for immediate deletion
                clipsToDeleteNow.push({
                  clip: clip,
                  trackIndex: a,
                  clipIndex: ac,
                  isVideo: false,
                  name: clip.name || 'Audio Silence',
                  startTime: clipStart,
                  endTime: clipEnd,
                  duration: clipDuration,
                  segmentId: segment.id
                })

                logMessage(
                  '  Found audio silence clip: ' +
                    clip.name +
                    ' on track ' +
                    (a + 1) +
                    ' (index: ' +
                    ac +
                    ')'
                )
              }
            }
          }
        }
      }

      // Check video tracks for matching clips (only if we found audio clips for THIS segment)
      // This ensures we only delete video segments that correspond to audio silence
      var audioClipsFoundNow = clipsToDeleteNow.length

      if (audioClipsFoundNow > 0) {
        logMessage(
          '  Found ' + audioClipsFoundNow + ' audio clips, searching for matching video clips...'
        )
        for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
          var videoTrack = sequence.videoTracks[v]

          for (var vc = 0; vc < videoTrack.clips.numItems; vc++) {
            var clip = videoTrack.clips[vc]
            if (clip) {
              var clipStart = parseFloat(clip.start.seconds)
              var clipEnd = parseFloat(clip.end.seconds)
              var clipDuration = clipEnd - clipStart

              // Use same improved matching logic as audio tracks
              var startsNearSegmentStart = Math.abs(clipStart - segmentStart) < tolerance
              var endsNearSegmentEnd = Math.abs(clipEnd - segmentEnd) < tolerance
              var durationMatches = Math.abs(clipDuration - segmentDuration) < tolerance

              var isContainedInSegment =
                clipStart >= segmentStart - tolerance && clipEnd <= segmentEnd + tolerance

              var isMatch =
                (startsNearSegmentStart && endsNearSegmentEnd && durationMatches) ||
                isContainedInSegment

              if (isMatch) {
                // Mark this clip for immediate deletion
                clipsToDeleteNow.push({
                  clip: clip,
                  trackIndex: v,
                  clipIndex: vc,
                  isVideo: true,
                  name: clip.name || 'Video Silence',
                  startTime: clipStart,
                  endTime: clipEnd,
                  duration: clipDuration,
                  segmentId: segment.id
                })

                logMessage(
                  '  Found video silence clip: ' +
                    clip.name +
                    ' on track ' +
                    (v + 1) +
                    ' (index: ' +
                    vc +
                    ')'
                )
              }
            }
          }
        }
      }

      // Now delete all clips found for THIS segment immediately
      totalClipsFound += clipsToDeleteNow.length

      if (clipsToDeleteNow.length === 0) {
        logMessage('  ⚠️ No clips found for this segment')
        continue
      }

      logMessage('  Deleting ' + clipsToDeleteNow.length + ' clips for this segment...')

      try {
        // Group clips by track to delete in correct order
        var clipsByTrack = {}

        for (var i = 0; i < clipsToDeleteNow.length; i++) {
          var clipData = clipsToDeleteNow[i]
          var trackKey = (clipData.isVideo ? 'video_' : 'audio_') + clipData.trackIndex

          if (!clipsByTrack[trackKey]) {
            clipsByTrack[trackKey] = []
          }
          clipsByTrack[trackKey].push(clipData)
        }

        logMessage('  Grouped clips into ' + Object.keys(clipsByTrack).length + ' tracks')

        // For each track, delete clips from highest index to lowest
        for (var trackKey in clipsByTrack) {
          if (clipsByTrack.hasOwnProperty(trackKey)) {
            var trackClips = clipsByTrack[trackKey]

            // Sort by clipIndex descending (highest first)
            trackClips.sort(function (a, b) {
              return b.clipIndex - a.clipIndex
            })

            logMessage(
              '  Track ' + trackKey + ': deleting ' + trackClips.length + ' clips in reverse order'
            )

            // Delete each clip in this track from highest to lowest index
            for (var i = 0; i < trackClips.length; i++) {
              var clipData = trackClips[i]

              try {
                // Use clip.remove() with ripple delete
                var removeResult = clipData.clip.remove(true, true)

                // Success can be: true, 0, or undefined (different Premiere versions)
                // Failure is: false or 1 (error code)
                if (removeResult !== false && removeResult !== 1) {
                  clipsDeleted++
                  results.push({
                    track: clipData.trackIndex + 1,
                    type: clipData.isVideo ? 'video' : 'audio',
                    name: clipData.name,
                    method: 'clip.remove(ripple)',
                    segmentId: clipData.segmentId,
                    timeRange: clipData.startTime + 's to ' + clipData.endTime + 's',
                    duration: clipData.duration + 's'
                  })
                  logMessage(
                    '    ✓ Deleted: ' +
                      clipData.name +
                      ' (index ' +
                      clipData.clipIndex +
                      ', result: ' +
                      removeResult +
                      ')'
                  )
                } else {
                  var errMsg =
                    'Failed to delete ' + clipData.name + ' - remove() returned: ' + removeResult
                  errors.push(errMsg)
                  logMessage('    ✗ ' + errMsg)
                }
              } catch (clipError) {
                var errMsg = 'Error deleting ' + clipData.name + ': ' + clipError.toString()
                errors.push(errMsg)
                logMessage('    ✗ ' + errMsg)
              }
            }
          }
        }

        logMessage('  ✅ Completed deletion for segment')
      } catch (deleteError) {
        var errorMsg = 'Failed to delete segment clips: ' + deleteError.toString()
        errors.push(errorMsg)
        logMessage('  ✗ Error: ' + errorMsg)
      }

      logMessage('  Completed segment ' + (s + 1) + ': deleted ' + clipsDeleted + ' clips so far')
    }

    var message = 'Deleted ' + clipsDeleted + ' silence clip(s)'
    if (errors.length > 0) {
      message += ' with ' + errors.length + ' error(s)'
    }

    logMessage('=== Deletion Summary ===')
    logMessage('Total clips found: ' + totalClipsFound)
    logMessage('Successfully deleted: ' + clipsDeleted)
    logMessage('Errors: ' + errors.length)

    return JSON.stringify({
      success: clipsDeleted > 0,
      message: message,
      clipsDeleted: clipsDeleted,
      totalClipsFound: totalClipsFound,
      deletedClips: results,
      errors: errors
    })
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Silence deletion failed: ' + error.toString()
    })
  }
}

/**
 * Identifies and mutes silence segments based on audio level analysis
 * @param {string} segmentsJSON - JSON string of silence segments with start/end times
 * @returns {string} JSON string with operation result
 */
function muteSilenceSegments(segmentsJSON) {
  try {
    var sequence = app.project.activeSequence
    if (!sequence) {
      return JSON.stringify({ success: false, error: 'No active sequence' })
    }

    var segments
    try {
      segments = JSON.parse(segmentsJSON)
    } catch (parseError) {
      return JSON.stringify({
        success: false,
        error: 'Invalid segments JSON: ' + parseError.toString()
      })
    }

    if (!segments || segments.length === 0) {
      return JSON.stringify({
        success: false,
        error: 'No silence segments provided'
      })
    }

    logMessage('Identifying silence clips for muting...')
    logMessage('Segments to mute: ' + segments.length)

    var clipsToMute = []
    var tolerance = 0.15 // 150ms tolerance for time matching (increased for post-cut precision)

    // Search through all tracks to find clips that match our silence segments
    for (var s = 0; s < segments.length; s++) {
      var segment = segments[s]
      var segmentStart = segment.start
      var segmentEnd = segment.end
      var segmentDuration = segmentEnd - segmentStart

      logMessage(
        'Looking for silence segment: ' +
          segmentStart +
          's to ' +
          segmentEnd +
          's (duration: ' +
          segmentDuration +
          's)'
      )

      // Only process segments that are likely to be silence (longer than 100ms)
      if (segmentDuration < 0.1) {
        logMessage('Skipping very short segment (< 100ms)')
        continue
      }

      // Check audio tracks first (silence detection is primarily audio-based)
      for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
        var audioTrack = sequence.audioTracks[a]

        for (var ac = 0; ac < audioTrack.clips.numItems; ac++) {
          var clip = audioTrack.clips[ac]
          if (clip) {
            var clipStart = parseFloat(clip.start.seconds)
            var clipEnd = parseFloat(clip.end.seconds)
            var clipDuration = clipEnd - clipStart

            // Use improved matching logic (same as deleteSilenceSegments)
            var startsNearSegmentStart = Math.abs(clipStart - segmentStart) < tolerance
            var endsNearSegmentEnd = Math.abs(clipEnd - segmentEnd) < tolerance
            var durationMatches = Math.abs(clipDuration - segmentDuration) < tolerance

            var isContainedInSegment =
              clipStart >= segmentStart - tolerance && clipEnd <= segmentEnd + tolerance

            var isMatch =
              (startsNearSegmentStart && endsNearSegmentEnd && durationMatches) ||
              isContainedInSegment

            if (isMatch) {
              // Mark this clip for muting
              clipsToMute.push({
                clip: clip,
                trackIndex: a,
                clipIndex: ac,
                isVideo: false,
                name: clip.name || 'Audio Silence',
                startTime: clipStart,
                endTime: clipEnd,
                duration: clipDuration,
                segmentId: segment.id
              })

              logMessage(
                'Found silence clip to mute: ' +
                  clip.name +
                  ' (' +
                  clipStart +
                  's to ' +
                  clipEnd +
                  's, duration: ' +
                  clipDuration +
                  's)'
              )
            }
          }
        }
      }

      // Check video tracks for matching clips (only if we found audio clips)
      // Count audio clips manually (ES3 compatible - no .filter())
      var audioClipsFound = 0
      for (var i = 0; i < clipsToMute.length; i++) {
        if (!clipsToMute[i].isVideo) {
          audioClipsFound++
        }
      }

      if (audioClipsFound > 0) {
        for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
          var videoTrack = sequence.videoTracks[v]

          for (var vc = 0; vc < videoTrack.clips.numItems; vc++) {
            var clip = videoTrack.clips[vc]
            if (clip) {
              var clipStart = parseFloat(clip.start.seconds)
              var clipEnd = parseFloat(clip.end.seconds)
              var clipDuration = clipEnd - clipStart

              // Use improved matching logic (same as audio tracks)
              var startsNearSegmentStart = Math.abs(clipStart - segmentStart) < tolerance
              var endsNearSegmentEnd = Math.abs(clipEnd - segmentEnd) < tolerance
              var durationMatches = Math.abs(clipDuration - segmentDuration) < tolerance

              var isContainedInSegment =
                clipStart >= segmentStart - tolerance && clipEnd <= segmentEnd + tolerance

              var isMatch =
                (startsNearSegmentStart && endsNearSegmentEnd && durationMatches) ||
                isContainedInSegment

              if (isMatch) {
                // Mark this clip for muting
                clipsToMute.push({
                  clip: clip,
                  trackIndex: v,
                  clipIndex: vc,
                  isVideo: true,
                  name: clip.name || 'Video Silence',
                  startTime: clipStart,
                  endTime: clipEnd,
                  duration: clipDuration,
                  segmentId: segment.id
                })

                logMessage(
                  'Found matching video clip (will be skipped): ' +
                    clip.name +
                    ' (' +
                    clipStart +
                    's to ' +
                    clipEnd +
                    's, duration: ' +
                    clipDuration +
                    's)'
                )
              }
            }
          }
        }
      }
    }

    if (clipsToMute.length === 0) {
      return JSON.stringify({
        success: false,
        message: 'No silence clips found matching the specified time ranges'
      })
    }

    logMessage('Found ' + clipsToMute.length + ' silence clips to mute')

    var clipsMuted = 0
    var results = []
    var errors = []

    // Mute each identified silence clip
    for (var i = 0; i < clipsToMute.length; i++) {
      var clipData = clipsToMute[i]

      try {
        // Select the clip first
        clipData.clip.isSelected = true

        // Apply muting based on clip type
        var muteSuccess = false
        if (clipData.isVideo) {
          // For video clips in silence segments, we don't need to do anything
          // The silence is in the audio tracks, not the video - keep video visible
          muteSuccess = true
          logMessage('Skipped video clip (no muting needed for silence): ' + clipData.name)
        } else {
          // For audio clips, mute by setting volume to -∞ dB (0.0 float)
          if (clipData.clip.components && clipData.clip.components.numItems > 0) {
            try {
              var volumeFound = false

              // Look for the Volume component specifically
              for (var c = 0; c < clipData.clip.components.numItems; c++) {
                var component = clipData.clip.components[c]
                if (
                  component &&
                  (component.displayName === 'Volume' ||
                    component.displayName === 'Audio Levels' ||
                    component.displayName === 'Channel Volume')
                ) {
                  if (component.properties && component.properties.numItems > 0) {
                    // Find the Level property (usually index 1, not 0)
                    var levelProperty = component.properties[1] || component.properties[0]
                    if (levelProperty) {
                      levelProperty.setValue(0.0) // -∞ dB
                      muteSuccess = true
                      volumeFound = true
                      logMessage('Muted audio clip by setting volume to -∞ dB: ' + clipData.name)
                      break
                    }
                  }
                }
              }

              // Fallback: If no Volume component found, try first component
              if (!volumeFound && clipData.clip.components.numItems > 0) {
                var firstComponent = clipData.clip.components[0]
                if (
                  firstComponent &&
                  firstComponent.properties &&
                  firstComponent.properties.numItems > 1
                ) {
                  // Audio clips typically have Level property at index 1
                  var levelProperty = firstComponent.properties[1]
                  if (levelProperty) {
                    levelProperty.setValue(0.0) // -∞ dB
                    muteSuccess = true
                    logMessage(
                      'Muted audio clip using first component level property: ' + clipData.name
                    )
                  }
                }
              }

              if (!muteSuccess) {
                errors.push('Could not find volume property for audio clip: ' + clipData.name)
              }
            } catch (volumeError) {
              errors.push(
                'Could not mute audio clip: ' + clipData.name + ' - ' + volumeError.toString()
              )
            }
          }
        }

        // Deselect the clip
        clipData.clip.isSelected = false

        if (muteSuccess) {
          clipsMuted++
          results.push({
            track: clipData.trackIndex + 1,
            type: clipData.isVideo ? 'video' : 'audio',
            name: clipData.name,
            method: clipData.isVideo ? 'skipped' : 'volume_-inf',
            segmentId: clipData.segmentId,
            timeRange: clipData.startTime + 's to ' + clipData.endTime + 's',
            duration: clipData.duration + 's'
          })
          logMessage(
            'Muted silence clip: ' + clipData.name + ' (duration: ' + clipData.duration + 's)'
          )
        }
      } catch (muteError) {
        errors.push('Error muting clip: ' + clipData.name + ' - ' + muteError.toString())
        logMessage('Error muting: ' + clipData.name + ' - ' + muteError.toString())
      }
    }

    var message = 'Muted ' + clipsMuted + ' silence clip(s)'
    if (errors.length > 0) {
      message += ' with ' + errors.length + ' error(s)'
    }

    return JSON.stringify({
      success: clipsMuted > 0,
      message: message,
      clipsMuted: clipsMuted,
      totalClipsFound: clipsToMute.length,
      mutedClips: results,
      errors: errors
    })
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Silence muting failed: ' + error.toString()
    })
  }
}

/**
 * Identifies and removes silence segments with gaps maintained based on audio level analysis
 * @param {string} segmentsJSON - JSON string of silence segments with start/end times
 * @returns {string} JSON string with operation result
 */
function removeSilenceSegmentsWithGaps(segmentsJSON) {
  try {
    var sequence = app.project.activeSequence
    if (!sequence) {
      return JSON.stringify({ success: false, error: 'No active sequence' })
    }

    var segments
    try {
      segments = JSON.parse(segmentsJSON)
    } catch (parseError) {
      return JSON.stringify({
        success: false,
        error: 'Invalid segments JSON: ' + parseError.toString()
      })
    }

    if (!segments || segments.length === 0) {
      return JSON.stringify({
        success: false,
        error: 'No silence segments provided'
      })
    }

    logMessage('Identifying silence clips for removal (keeping gaps)...')
    logMessage('Segments to remove: ' + segments.length)

    var clipsToRemove = []
    var tolerance = 0.15 // 150ms tolerance for time matching (increased for post-cut precision)

    // Search through all tracks to find clips that match our silence segments
    for (var s = 0; s < segments.length; s++) {
      var segment = segments[s]
      var segmentStart = segment.start
      var segmentEnd = segment.end
      var segmentDuration = segmentEnd - segmentStart

      logMessage(
        'Looking for silence segment: ' +
          segmentStart +
          's to ' +
          segmentEnd +
          's (duration: ' +
          segmentDuration +
          's)'
      )

      // Only process segments that are likely to be silence (longer than 100ms)
      if (segmentDuration < 0.1) {
        logMessage('Skipping very short segment (< 100ms)')
        continue
      }

      // Check audio tracks first (silence detection is primarily audio-based)
      for (var a = 0; a < sequence.audioTracks.numTracks; a++) {
        var audioTrack = sequence.audioTracks[a]

        for (var ac = 0; ac < audioTrack.clips.numItems; ac++) {
          var clip = audioTrack.clips[ac]
          if (clip) {
            var clipStart = parseFloat(clip.start.seconds)
            var clipEnd = parseFloat(clip.end.seconds)
            var clipDuration = clipEnd - clipStart

            // Use improved matching logic (same as other functions)
            var startsNearSegmentStart = Math.abs(clipStart - segmentStart) < tolerance
            var endsNearSegmentEnd = Math.abs(clipEnd - segmentEnd) < tolerance
            var durationMatches = Math.abs(clipDuration - segmentDuration) < tolerance

            var isContainedInSegment =
              clipStart >= segmentStart - tolerance && clipEnd <= segmentEnd + tolerance

            var isMatch =
              (startsNearSegmentStart && endsNearSegmentEnd && durationMatches) ||
              isContainedInSegment

            if (isMatch) {
              // Mark this clip for removal
              clipsToRemove.push({
                clip: clip,
                trackIndex: a,
                clipIndex: ac,
                isVideo: false,
                name: clip.name || 'Audio Silence',
                startTime: clipStart,
                endTime: clipEnd,
                duration: clipDuration,
                segmentId: segment.id
              })

              logMessage(
                'Found silence clip to remove: ' +
                  clip.name +
                  ' (' +
                  clipStart +
                  's to ' +
                  clipEnd +
                  's, duration: ' +
                  clipDuration +
                  's)'
              )
            }
          }
        }
      }

      // Check video tracks for matching clips (only if we found audio clips)
      // Count audio clips manually (ES3 compatible - no .filter())
      var audioClipsFound = 0
      for (var i = 0; i < clipsToRemove.length; i++) {
        if (!clipsToRemove[i].isVideo) {
          audioClipsFound++
        }
      }

      if (audioClipsFound > 0) {
        for (var v = 0; v < sequence.videoTracks.numTracks; v++) {
          var videoTrack = sequence.videoTracks[v]

          for (var vc = 0; vc < videoTrack.clips.numItems; vc++) {
            var clip = videoTrack.clips[vc]
            if (clip) {
              var clipStart = parseFloat(clip.start.seconds)
              var clipEnd = parseFloat(clip.end.seconds)
              var clipDuration = clipEnd - clipStart

              // Use improved matching logic (same as audio tracks)
              var startsNearSegmentStart = Math.abs(clipStart - segmentStart) < tolerance
              var endsNearSegmentEnd = Math.abs(clipEnd - segmentEnd) < tolerance
              var durationMatches = Math.abs(clipDuration - segmentDuration) < tolerance

              var isContainedInSegment =
                clipStart >= segmentStart - tolerance && clipEnd <= segmentEnd + tolerance

              var isMatch =
                (startsNearSegmentStart && endsNearSegmentEnd && durationMatches) ||
                isContainedInSegment

              if (isMatch) {
                // Mark this clip for removal
                clipsToRemove.push({
                  clip: clip,
                  trackIndex: v,
                  clipIndex: vc,
                  isVideo: true,
                  name: clip.name || 'Video Silence',
                  startTime: clipStart,
                  endTime: clipEnd,
                  duration: clipDuration,
                  segmentId: segment.id
                })

                logMessage(
                  'Found matching video clip to remove: ' +
                    clip.name +
                    ' (' +
                    clipStart +
                    's to ' +
                    clipEnd +
                    's, duration: ' +
                    clipDuration +
                    's)'
                )
              }
            }
          }
        }
      }
    }

    if (clipsToRemove.length === 0) {
      return JSON.stringify({
        success: false,
        message: 'No silence clips found matching the specified time ranges'
      })
    }

    logMessage('Found ' + clipsToRemove.length + ' silence clips to remove (keeping gaps)')

    // Sort clips by start time (latest first) to prevent index shifting during removal
    clipsToRemove.sort(function (a, b) {
      return b.startTime - a.startTime
    })

    var clipsRemoved = 0
    var results = []
    var errors = []

    // Remove each identified silence clip using proper removal with gaps preserved
    for (var i = 0; i < clipsToRemove.length; i++) {
      var clipData = clipsToRemove[i]

      try {
        // Use proper deletion with ripple: false to maintain gaps
        var result = properDeleteClip(
          clipData.trackIndex,
          clipData.clipIndex,
          clipData.isVideo,
          false // ripple = false to maintain gaps
        )

        if (result.success) {
          clipsRemoved++
          results.push({
            track: clipData.trackIndex + 1,
            type: clipData.isVideo ? 'video' : 'audio',
            name: clipData.name,
            method: result.method,
            segmentId: clipData.segmentId,
            timeRange: clipData.startTime + 's to ' + clipData.endTime + 's',
            duration: clipData.duration + 's'
          })
          logMessage(
            'Removed silence clip (gap preserved): ' +
              clipData.name +
              ' (duration: ' +
              clipData.duration +
              's)'
          )
        } else {
          errors.push('Failed to remove clip: ' + clipData.name + ' - ' + result.error)
          logMessage('Failed to remove: ' + clipData.name + ' - ' + result.error)
        }
      } catch (removeError) {
        errors.push('Error removing clip: ' + clipData.name + ' - ' + removeError.toString())
        logMessage('Error removing: ' + clipData.name + ' - ' + removeError.toString())
      }
    }

    var message = 'Removed ' + clipsRemoved + ' silence clip(s) with gaps preserved'
    if (errors.length > 0) {
      message += ' with ' + errors.length + ' error(s)'
    }

    return JSON.stringify({
      success: clipsRemoved > 0,
      message: message,
      clipsRemoved: clipsRemoved,
      totalClipsFound: clipsToRemove.length,
      removedClips: results,
      errors: errors
    })
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Silence removal with gaps failed: ' + error.toString()
    })
  }
}

// ==============================================================================
// AUDIO EXPORT MODULE
// ==============================================================================

/**
 * Exports the active sequence's audio as a WAV file
 * @param {string} outputFolder - Optional output folder (defaults to system temp for backward compatibility)
 * @returns {string} JSON string containing the file path or error message
 */
function exportActiveSequenceAudio(outputFolder) {
  try {
    // Check if there's an active project and sequence
    if (!app.project || !app.project.activeSequence) {
      return JSON.stringify({
        success: false,
        error: 'No active sequence found'
      })
    }

    var activeSequence = app.project.activeSequence
    var timestamp = new Date().getTime()
    var fileName = 'cleancut_audio_' + timestamp + '.wav'

    // Use provided output folder or fallback to system temp for backward compatibility
    var exportPath
    if (outputFolder && outputFolder.length > 0) {
      var lastChar = outputFolder.charAt(outputFolder.length - 1)
      if (lastChar !== '/' && lastChar !== '\\') {
        outputFolder += '/'
      }
      exportPath = outputFolder + fileName
    } else {
      // Fallback to system temp directory for backward compatibility
      var tempFolder = Folder.temp
      exportPath = tempFolder.fsName + '/' + fileName
    }

    var success = activeSequence.exportAsMediaDirect(
      exportPath,
      app.encoder.encodePresets.match('Microsoft AVI'),
      app.encoder.ENCODE_ENTIRE_SEQUENCE
    )

    return JSON.stringify({
      success: success,
      filePath: success ? exportPath : null,
      error: success ? null : 'Failed to export audio',
      outputFolder: outputFolder || 'system temp'
    })
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Export error: ' + error.toString(),
      outputFolder: outputFolder || 'system temp'
    })
  }
}
/**
 * Exports sequence audio using Adobe Media Encoder API for better track control
 * @param {string} outputFolder - Folder path for export (optional)
 * @param {string} selectedTracksJson - JSON string array of selected audio track indices
 * @param {string} selectedRange - Range type: 'entire', 'inout', 'selected'
 * @returns {string} JSON string with operation result
 */
function exportSequenceAudio(outputFolder, selectedTracksJson, selectedRange) {
  try {
    var debugInfo = {
      method: 'QE_DOM',
      outputFolder: outputFolder,
      selectedTracksJson: selectedTracksJson,
      selectedTracksType: typeof selectedTracksJson,
      selectedTracksConstructor:
        selectedTracksJson && selectedTracksJson.constructor
          ? selectedTracksJson.constructor.name
          : 'null',
      selectedTracksLength: selectedTracksJson ? selectedTracksJson.length : 'null',
      selectedTracksStringified: '',
      selectedRange: selectedRange || 'entire'
    }

    // Capture stringified value for debugging
    try {
      debugInfo.selectedTracksStringified = String(selectedTracksJson).substring(0, 100)
    } catch (stringifyError) {
      debugInfo.selectedTracksStringified = 'error: ' + stringifyError.toString()
    }

    logMessage('=== EXPORT SEQUENCE AUDIO VIA QE DOM ===')
    logMessage('Output folder: ' + outputFolder)
    logMessage('Selected tracks JSON: ' + selectedTracksJson)
    logMessage('Selected range: ' + (selectedRange || 'entire'))

    if (!app.project || !app.project.activeSequence) {
      return JSON.stringify({
        success: false,
        error: 'No active sequence',
        debug: debugInfo
      })
    }

    var sequence = app.project.activeSequence
    var selectedTracks = []

    // Parse selected tracks if provided - robust handling of various input types
    if (selectedTracksJson && selectedTracksJson.length > 0) {
      var inputType = typeof selectedTracksJson
      debugInfo.parsingMethod = 'none'

      logMessage(
        'Parsing selectedTracksJson - type: ' + inputType + ', length: ' + selectedTracksJson.length
      )

      try {
        if (inputType === 'string') {
          // Case 1: Input is a JSON string - parse it
          logMessage('Parsing as JSON string')
          selectedTracks = JSON.parse(selectedTracksJson)
          debugInfo.parsingMethod = 'JSON.parse'
        } else if (inputType === 'object' && selectedTracksJson !== null) {
          // Case 2: Input is already an object (common in ExtendScript eval context)

          // Check if it's array-like (has numeric length property)
          if (typeof selectedTracksJson.length === 'number' && selectedTracksJson.length > 0) {
            logMessage('Converting array-like object to array')
            selectedTracks = []
            for (var k = 0; k < selectedTracksJson.length; k++) {
              selectedTracks.push(selectedTracksJson[k])
            }
            debugInfo.parsingMethod = 'array-like-conversion'
          } else if (selectedTracksJson.length === 0) {
            // Empty array-like object
            logMessage('Empty array-like object detected')
            selectedTracks = []
            debugInfo.parsingMethod = 'empty-array-like'
          } else {
            // Plain object - try to extract values
            logMessage('Converting plain object to array')
            selectedTracks = []
            for (var key in selectedTracksJson) {
              if (selectedTracksJson.hasOwnProperty(key)) {
                selectedTracks.push(selectedTracksJson[key])
              }
            }
            debugInfo.parsingMethod = 'object-values-extraction'
          }
        } else {
          // Case 3: Unexpected type - try string conversion then parse
          logMessage('Unexpected type, attempting string conversion')
          var stringified = String(selectedTracksJson)
          selectedTracks = JSON.parse(stringified)
          debugInfo.parsingMethod = 'string-conversion-fallback'
        }

        logMessage('Parsing successful using method: ' + debugInfo.parsingMethod)
        logMessage('Selected tracks for export: ' + selectedTracks.join(', '))
        debugInfo.selectedTracksParsed = selectedTracks
      } catch (parseError) {
        debugInfo.parseError = parseError.toString()
        logMessage('Parse error: ' + parseError.toString())
        return JSON.stringify({
          success: false,
          error:
            'Invalid selected tracks format: ' +
            parseError.toString() +
            ' (type: ' +
            inputType +
            ')',
          debug: debugInfo
        })
      }
    } else {
      logMessage('No specific tracks selected, exporting all audio tracks')
      debugInfo.selectedTracksParsed = 'none - exporting all'
      debugInfo.parsingMethod = 'not-required'
    }

    // Validation: Verify selectedTracks is a proper array with numbers
    if (selectedTracks.length > 0) {
      var validationErrors = []
      var hasNonNumeric = false

      // Check if selectedTracks is actually an array
      if (typeof selectedTracks.join !== 'function') {
        logMessage('WARNING: selectedTracks is not a proper array after parsing')
        validationErrors.push('Not a proper array')
      }

      // Validate each element is a number
      for (var v = 0; v < selectedTracks.length; v++) {
        var trackNum = selectedTracks[v]
        if (typeof trackNum !== 'number' && isNaN(Number(trackNum))) {
          hasNonNumeric = true
          validationErrors.push('Track at index ' + v + ' is not a number: ' + trackNum)
        } else if (typeof trackNum !== 'number') {
          // Convert to number if it's numeric but not a number type
          selectedTracks[v] = Number(trackNum)
          logMessage('Converted track at index ' + v + ' to number: ' + selectedTracks[v])
        }
      }

      if (validationErrors.length > 0) {
        debugInfo.validationErrors = validationErrors
        logMessage('Validation warnings: ' + validationErrors.join('; '))
      }

      if (hasNonNumeric) {
        return JSON.stringify({
          success: false,
          error: 'Selected tracks contains non-numeric values: ' + validationErrors.join(', '),
          debug: debugInfo
        })
      }

      logMessage('Validation passed: ' + selectedTracks.length + ' tracks are valid numbers')
      debugInfo.validationPassed = true
    }

    // Generate unique filename and output path
    var timestamp = new Date().getTime()
    var sequenceName = sequence.name.replace(/[^a-zA-Z0-9]/g, '_')
    var filename = sequenceName + '_audio_' + timestamp + '.wav'

    // Output folder is now required - no fallback to system temp
    if (!outputFolder || outputFolder.length === 0) {
      return JSON.stringify({
        success: false,
        error: 'Output folder is required - no fallback to system temp directory',
        debug: debugInfo
      })
    }

    var outputPath = outputFolder
    var lastChar = outputPath.charAt(outputPath.length - 1)
    if (lastChar !== '/' && lastChar !== '\\') {
      outputPath += '/'
    }
    outputPath += filename

    debugInfo.outputPath = outputPath

    // Get preset file - use the same output folder for consistency
    var presetResult = getPresetFilePath(outputFolder)
    if (!presetResult.path) {
      return JSON.stringify({
        success: false,
        error: 'Preset file not found',
        debug: debugInfo
      })
    }
    var audioPresetPath = presetResult.path
    debugInfo.presetPath = audioPresetPath
    debugInfo.presetDebug = presetResult.debug

    // Enable QE DOM for better track control
    app.enableQE()
    var qeSequence = qe.project.getActiveSequence()

    if (!qeSequence) {
      return JSON.stringify({
        success: false,
        error: 'QE sequence not available',
        debug: debugInfo
      })
    }

    logMessage('Using QE DOM for track control')
    debugInfo.qeAvailable = true
    debugInfo.totalQETracks = qeSequence.numAudioTracks

    // Store original track states
    var originalStates = []
    for (var i = 0; i < qeSequence.numAudioTracks; i++) {
      var qeTrack = qeSequence.getAudioTrackAt(i)
      if (qeTrack) {
        var originalState = {
          index: i,
          trackNumber: i + 1,
          muted: false,
          solo: false
        }

        // Get original states
        try {
          if (typeof qeTrack.isMuted === 'function') {
            originalState.muted = qeTrack.isMuted()
          }
          if (typeof qeTrack.isSolo === 'function') {
            originalState.solo = qeTrack.isSolo()
          }
        } catch (stateError) {
          logMessage(
            'Error getting original state for track ' + (i + 1) + ': ' + stateError.toString()
          )
        }

        originalStates.push(originalState)
        logMessage(
          'Track ' +
            (i + 1) +
            ' original state - muted: ' +
            originalState.muted +
            ', solo: ' +
            originalState.solo
        )
      }
    }

    try {
      // Apply selective track control using QE DOM
      if (selectedTracks.length > 0) {
        logMessage('Applying selective track control using QE DOM...')

        for (var j = 0; j < qeSequence.numAudioTracks; j++) {
          var qeTrack = qeSequence.getAudioTrackAt(j)
          var trackNumber = j + 1
          var shouldExport = selectedTracks.indexOf(trackNumber) !== -1

          if (qeTrack) {
            try {
              // Use solo approach for cleaner selective export
              if (typeof qeTrack.setSolo === 'function') {
                qeTrack.setSolo(shouldExport)
                logMessage('Track ' + trackNumber + ' solo set to: ' + shouldExport)
              } else if (typeof qeTrack.setMute === 'function') {
                // Fallback to mute approach - mute non-selected tracks
                qeTrack.setMute(!shouldExport)
                logMessage('Track ' + trackNumber + ' muted: ' + !shouldExport)
              }
            } catch (trackControlError) {
              logMessage(
                'Error controlling track ' + trackNumber + ': ' + trackControlError.toString()
              )
            }
          }
        }

        debugInfo.trackControlMethod = 'QE DOM solo/mute'
        debugInfo.tracksProcessed = qeSequence.numAudioTracks
      }

      // Handle different range types
      var workAreaType = 0 // Default: entire sequence
      var rangeType = selectedRange || 'entire'
      var originalInPoint = null
      var originalOutPoint = null
      var tempInOutSet = false
      var timeOffsetSeconds = 0 // Track the time offset for cut commands

      if (rangeType === 'inout') {
        workAreaType = 1 // In/Out points
        logMessage('Using In/Out points for export')

        // Calculate time offset for in/out points
        try {
          var rawInPoint = sequence.getInPoint()
          var inPointSeconds = parseFloat(rawInPoint) || 0

          // sequence.getInPoint() returns seconds, not ticks!
          timeOffsetSeconds = inPointSeconds

          logMessage('In/Out point time offset: ' + timeOffsetSeconds + ' seconds')
          debugInfo.timeOffsetSeconds = timeOffsetSeconds
        } catch (offsetError) {
          logMessage('Error calculating in/out offset: ' + offsetError.toString())
          debugInfo.offsetError = offsetError.toString()
          timeOffsetSeconds = 0
        }
      } else if (rangeType === 'selected') {
        // For selected clips, we need to get their time range and set temporary in/out points
        logMessage('Getting selected clips range...')

        try {
          // Store original in/out points
          originalInPoint = sequence.getInPoint()
          originalOutPoint = sequence.getOutPoint()

          // Get selected clips and find their time range
          var selectedClipsRange = getSelectedClipsTimeRange(sequence)

          if (selectedClipsRange.success) {
            logMessage(
              'Selected clips range: ' +
                selectedClipsRange.startTime +
                ' to ' +
                selectedClipsRange.endTime +
                ' seconds'
            )

            // Set time offset to the start of selected clips
            timeOffsetSeconds = selectedClipsRange.startTime
            logMessage('Selected clips time offset: ' + timeOffsetSeconds + ' seconds')

            // Convert to ticks (254016000000 ticks per second)
            var ticksPerSecond = 254016000000
            var startTicks = Math.round(selectedClipsRange.startTime * ticksPerSecond)
            var endTicks = Math.round(selectedClipsRange.endTime * ticksPerSecond)

            // Set temporary in/out points
            sequence.setInPoint(startTicks.toString())
            sequence.setOutPoint(endTicks.toString())
            tempInOutSet = true

            workAreaType = 1 // Use in/out points method
            logMessage('Set temporary in/out points for selected clips export')

            debugInfo.selectedClipsStart = selectedClipsRange.startTime
            debugInfo.selectedClipsEnd = selectedClipsRange.endTime
            debugInfo.tempInOutSet = true
            debugInfo.timeOffsetSeconds = timeOffsetSeconds
          } else {
            logMessage('No valid selected clips found, falling back to entire timeline')
            workAreaType = 0 // Fallback to entire sequence
            timeOffsetSeconds = 0
            debugInfo.selectedClipsError = selectedClipsRange.error
          }
        } catch (selectedError) {
          logMessage('Error handling selected clips: ' + selectedError.toString())
          workAreaType = 0 // Fallback to entire sequence
          timeOffsetSeconds = 0
          debugInfo.selectedClipsError = selectedError.toString()
        }
      } else {
        workAreaType = 0 // Entire sequence
        timeOffsetSeconds = 0 // No offset for entire timeline
        logMessage('Using entire timeline for export')
      }

      debugInfo.workAreaType = workAreaType
      debugInfo.rangeType = rangeType

      // Export using standard sequence with QE-modified states
      logMessage('Starting export with QE DOM controlled track states...')
      var exportResult = sequence.exportAsMediaDirect(outputPath, audioPresetPath, workAreaType)

      // Restore original in/out points if we set temporary ones
      if (tempInOutSet) {
        try {
          logMessage('Restoring original in/out points...')
          if (originalInPoint !== null) {
            sequence.setInPoint(originalInPoint.toString())
          }
          if (originalOutPoint !== null) {
            sequence.setOutPoint(originalOutPoint.toString())
          }
          logMessage('Original in/out points restored')
        } catch (restoreError) {
          logMessage('Error restoring in/out points: ' + restoreError.toString())
          debugInfo.restoreInOutError = restoreError.toString()
        }
      }

      if (!exportResult) {
        throw new Error('Export failed - exportAsMediaDirect returned false')
      }

      debugInfo.exportMethod = 'exportAsMediaDirect with QE DOM'
      debugInfo.exportResult = exportResult
    } finally {
      // Always restore original track states
      try {
        logMessage('Restoring original track states...')

        for (var k = 0; k < originalStates.length; k++) {
          var stateInfo = originalStates[k]
          var qeTrack = qeSequence.getAudioTrackAt(stateInfo.index)

          if (qeTrack) {
            try {
              // Restore solo state
              if (typeof qeTrack.setSolo === 'function') {
                qeTrack.setSolo(stateInfo.solo)
                logMessage(
                  'Restored track ' + stateInfo.trackNumber + ' solo to: ' + stateInfo.solo
                )
              }

              // Restore mute state
              if (typeof qeTrack.setMute === 'function') {
                qeTrack.setMute(stateInfo.muted)
                logMessage(
                  'Restored track ' + stateInfo.trackNumber + ' mute to: ' + stateInfo.muted
                )
              }
            } catch (restoreError) {
              logMessage(
                'Error restoring track ' + stateInfo.trackNumber + ': ' + restoreError.toString()
              )
            }
          }
        }

        logMessage('Restored original states for ' + originalStates.length + ' tracks')
      } catch (restoreError) {
        logMessage('Error during track state restoration: ' + restoreError.toString())
        debugInfo.restoreError = restoreError.toString()
      }
    }

    var exportMessage = 'Audio export completed successfully'
    if (selectedTracks.length > 0) {
      exportMessage += ' for tracks: ' + selectedTracks.join(', ')
    }

    var rangeDescription = ''
    if (selectedRange === 'inout') {
      rangeDescription = ' (In/Out points)'
    } else if (selectedRange === 'selected') {
      rangeDescription = ' (Selected clips)'
    } else {
      rangeDescription = ' (Entire timeline)'
    }

    exportMessage += rangeDescription + ' using QE DOM'

    debugInfo.success = true

    return JSON.stringify({
      success: true,
      outputPath: outputPath,
      presetUsed: audioPresetPath,
      message: exportMessage,
      selectedTracks: selectedTracks,
      timeOffsetSeconds: timeOffsetSeconds,
      debug: debugInfo
    })
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'QE DOM export error: ' + error.toString(),
      debug: debugInfo
    })
  }
}

// ==============================================================================
// CUTTING MODULE
// ==============================================================================

/**
 * Performs cuts on the timeline based on provided timestamps
 * @param {string} timestampsJSON - JSON string containing array of {start, end} timestamps
 * @returns {string} JSON string with success status and message
 */
function performCuts(timestampsJSON) {
  try {
    // Check if there's an active sequence
    if (!app.project || !app.project.activeSequence) {
      return JSON.stringify({
        success: false,
        error: 'No active sequence found'
      })
    }

    var activeSequence = app.project.activeSequence
    var timestamps

    try {
      timestamps = JSON.parse(timestampsJSON)
    } catch (parseError) {
      return JSON.stringify({
        success: false,
        error: 'Invalid JSON format: ' + parseError.toString()
      })
    }

    if (!timestamps || !timestamps.length) {
      return JSON.stringify({
        success: false,
        error: 'No timestamps provided'
      })
    }

    var cutsPerformed = 0
    var errors = []

    for (var i = 0; i < timestamps.length; i++) {
      var timestamp = timestamps[i]

      if (!timestamp.hasOwnProperty('start') || !timestamp.hasOwnProperty('end')) {
        errors.push('Invalid timestamp object at index ' + i + ': missing start or end')
        continue
      }

      try {
        var startTime = timestamp.start * activeSequence.timebase
        var endTime = timestamp.end * activeSequence.timebase

        activeSequence.razor(startTime)
        activeSequence.razor(endTime)
        cutsPerformed += 2
      } catch (cutError) {
        errors.push('Error cutting at timestamp ' + i + ': ' + cutError.toString())
      }
    }

    var resultMessage = 'Performed ' + cutsPerformed + ' cuts'
    if (errors.length > 0) {
      resultMessage += ' with ' + errors.length + ' errors'
    }

    return JSON.stringify({
      success: errors.length === 0 || cutsPerformed > 0,
      message: resultMessage,
      cutsPerformed: cutsPerformed,
      errors: errors
    })
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Cutting error: ' + error.toString()
    })
  }
}

/**
 * Performs a single cut at the specified time in seconds
 * @param {number} timeInSeconds - Time in decimal seconds to cut at
 * @returns {string} JSON string with success status and message
 */
function cutAtTime(timeInSeconds) {
  try {
    if (!app.project || !app.project.activeSequence) {
      return JSON.stringify({
        success: false,
        error: 'No active sequence'
      })
    }

    var sequence = app.project.activeSequence

    // Convert seconds to ticks (254016000000 ticks per second)
    var ticksPerSecond = 254016000000
    var cutTimeTicks = Math.round(timeInSeconds * ticksPerSecond)

    // Move the playhead to the cut position
    sequence.setPlayerPosition(cutTimeTicks.toString())

    // Enable QE DOM for razor functionality (same approach as cutAllTracksAtTime)
    try {
      app.enableQE()
      var qeSequence = qe.project.getActiveSequence()

      if (!qeSequence) {
        return JSON.stringify({
          success: false,
          error: 'Could not access QE sequence'
        })
      }

      // Get the current playhead position in QE format
      var currentTimecode = qeSequence.CTI.timecode
      var cutsPerformed = 0

      // Cut all video tracks at the playhead position
      try {
        for (var v = 0; v < qeSequence.numVideoTracks; v++) {
          var videoTrack = qeSequence.getVideoTrackAt(v)
          if (videoTrack) {
            videoTrack.razor(currentTimecode)
            cutsPerformed++
          }
        }
      } catch (videoError) {
        // Continue with audio tracks even if video fails
      }

      // Cut all audio tracks at the playhead position
      try {
        for (var a = 0; a < qeSequence.numAudioTracks; a++) {
          var audioTrack = qeSequence.getAudioTrackAt(a)
          if (audioTrack) {
            audioTrack.razor(currentTimecode)
            cutsPerformed++
          }
        }
      } catch (audioError) {
        // Track any audio errors
      }

      return JSON.stringify({
        success: true,
        message: 'Cut completed at ' + timeInSeconds.toFixed(3) + 's',
        cutsPerformed: cutsPerformed,
        timeInSeconds: timeInSeconds
      })
    } catch (qeError) {
      return JSON.stringify({
        success: false,
        error: 'QE DOM cutting failed: ' + qeError.toString()
      })
    }
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: 'Cut operation error: ' + error.toString()
    })
  }
}
