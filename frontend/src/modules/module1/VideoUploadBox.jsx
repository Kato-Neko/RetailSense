import { Upload } from "lucide-react";

const VideoUploadBox = ({ file, onFileChange, videoRef }) => (
  <div className="left-box" style={{ width: '100%', height: 420, background: 'var(--card-bg)', borderRadius: 8, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
    <label className="upload-label" style={{ width: '100%', height: '100%', margin: 0, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', background: 'none' }}>
      {file ? (
        <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8, background: '#111' }} src={URL.createObjectURL(file)} muted playsInline />
      ) : (
        <div style={{ textAlign: 'center', color: 'var(--text-light)' }}>
          <Upload className="upload-icon" />
          <div>Drag & drop or click to upload video</div>
        </div>
      )}
      <input type="file" className="upload-input" accept="video/*" onChange={onFileChange} style={{ display: 'none' }} />
    </label>
  </div>
);

export default VideoUploadBox; 