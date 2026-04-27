use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Stream, StreamConfig};
use hound::WavWriter;
use std::sync::{Arc, Mutex};
use std::io::Cursor;

const SAMPLE_RATE: u32 = 16000;
const CHANNELS: u16 = 1;

pub struct AudioRecorder {
    frames: Arc<Mutex<Vec<f32>>>,
    stream: Option<Stream>,
    writer_config: StreamConfig,
    rms_level: Arc<Mutex<f32>>,
    is_recording: Arc<Mutex<bool>>,
}

impl AudioRecorder {
    pub fn new() -> Self {
        let config = StreamConfig {
            channels: CHANNELS,
            sample_rate: u32::from(SAMPLE_RATE).into(),
            buffer_size: cpal::BufferSize::Default,
        };

        Self {
            frames: Arc::new(Mutex::new(Vec::new())),
            stream: None,
            writer_config: config,
            rms_level: Arc::new(Mutex::new(0.0)),
            is_recording: Arc::new(Mutex::new(false)),
        }
    }

    pub fn start(&mut self) -> anyhow::Result<()> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| anyhow::anyhow!("No input device available"))?;

        let frames = Arc::clone(&self.frames);
        let rms_level = Arc::clone(&self.rms_level);
        let is_recording = Arc::clone(&self.is_recording);

        *frames.lock().unwrap() = Vec::new();
        *is_recording.lock().unwrap() = true;

        let stream = device.build_input_stream(
            &self.writer_config,
            move |data, _| {
                if !*is_recording.lock().unwrap() {
                    return;
                }

                let mut frames = frames.lock().unwrap();
                for &sample in data {
                    frames.push(sample);
                }

                // Calculate RMS
                let rms = frames.iter().map(|s| s * s).sum::<f32>() / frames.len() as f32;
                let rms = rms.sqrt();
                *rms_level.lock().unwrap() = (rms / 0.1).min(1.0);
            },
            |err| eprintln!("stream error: {}", err),
            None,
        )?;

        stream.play()?;
        self.stream = Some(stream);
        Ok(())
    }

    pub fn stop(&mut self) -> anyhow::Result<()> {
        *self.is_recording.lock().unwrap() = false;
        if let Some(stream) = self.stream.take() {
            drop(stream);
        }
        Ok(())
    }

    pub fn get_wav_bytes(&self) -> anyhow::Result<Vec<u8>> {
        let frames = self.frames.lock().unwrap().clone();
        if frames.is_empty() {
            return Err(anyhow::anyhow!("No audio recorded"));
        }

        let mut cursor = Cursor::new(Vec::new());
        let mut writer = WavWriter::new(
            &mut cursor,
            hound::WavSpec {
                channels: CHANNELS,
                sample_rate: SAMPLE_RATE,
                bits_per_sample: 16,
                sample_format: hound::SampleFormat::Int,
            },
        )?;

        for &sample in &frames {
            let sample_i16 = (sample * 32767.0).clamp(-32768.0, 32767.0) as i16;
            writer.write_sample(sample_i16)?;
        }

        writer.finalize()?;
        Ok(cursor.into_inner())
    }

    pub fn get_rms_level(&self) -> f32 {
        *self.rms_level.lock().unwrap()
    }

    pub fn duration_seconds(&self) -> f32 {
        let frames = self.frames.lock().unwrap();
        frames.len() as f32 / SAMPLE_RATE as f32
    }
}

impl Default for AudioRecorder {
    fn default() -> Self {
        Self::new()
    }
}
