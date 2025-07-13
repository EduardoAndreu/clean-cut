// Clean-Cut Preset Management Module
// This module handles audio export preset creation and management

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
