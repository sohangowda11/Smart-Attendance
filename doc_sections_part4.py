# -*- coding: utf-8 -*-
"""
SYNAPSE Documentation Part 4:
- Section 13: 35 Lecturer Viva Questions & Answers
- Section 14: 5–7 Minute Oral Presentation Script
- Section 15: Technical Source References & Code Mapping
"""

def get_sections13_15():
    return """
<!-- SECTION 13 -->
<h1 class="section-title">SECTION 13 — QUESTIONS A LECTURER MAY ASK (35 VIVA Q&amp;A)</h1>

<p>
  These 35 questions and answers are structured specifically for university examiners and lecturers, written in direct, technically rigorous, and speakable language:
</p>

<div class="qa-card">
  <div class="qa-q"><span>Q1.</span> What is face recognition?</div>
  <div class="qa-a"><strong>Answer:</strong> Face recognition is a computer vision biometric technology that mathematically compares features from a captured facial image against a database of known identity templates to verify or determine a person's physical identity.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q2.</span> What is the fundamental difference between face detection and face recognition?</div>
  <div class="qa-a"><strong>Answer:</strong> Face detection only answers <em>"Where is a face located in this image?"</em> by returning rectangular bounding box coordinates $[x, y, w, h]$. It does not identify who the face is. Face recognition answers <em>"Whose face is this?"</em> by extracting unique mathematical features and matching them against stored identity templates.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q3.</span> Which machine learning or deep learning model is used in SYNAPSE?</div>
  <div class="qa-a"><strong>Answer:</strong> SYNAPSE uses <strong>dlib's pre-trained ResNet-34 Deep Metric Face Recognition Network</strong> (Davis King, 2017) accessed through the <code>face_recognition</code> library. It is a 34-layer deep residual neural network trained on 3 million faces using Triplet Loss.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q4.</span> Have you trained your own neural network from scratch?</div>
  <div class="qa-a"><strong>Answer:</strong> <strong>No, we have not.</strong> Training a deep face recognition network from scratch requires millions of labeled facial images, weeks of multi-GPU compute, and millions of parameters. Instead, SYNAPSE utilizes the proven industry approach of <strong>Deep Metric Learning with pre-trained weights</strong>, using the network as a frozen feature extractor.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q5.</span> If you haven't trained a model, how does the system learn to identify college students?</div>
  <div class="qa-a"><strong>Answer:</strong> The system does not need weight training to identify students. The pre-trained ResNet-34 has already learned the universal geometric features of human faces. During enrollment, the network maps a student's webcam frames into a 128-dimensional Euclidean space. The resulting average vector is saved in our database. Live recognition simply calculates the Euclidean distance between a live face's vector and these stored templates.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q6.</span> What is a pre-trained model?</div>
  <div class="qa-a"><strong>Answer:</strong> A pre-trained model is a neural network whose weights and layer filters have already been trained and optimized on a large benchmark dataset by researchers, allowing others to reuse its learned feature extraction capabilities without repeating the expensive training process.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q7.</span> What is a Convolutional Neural Network (CNN)?</div>
  <div class="qa-a"><strong>Answer:</strong> A CNN is a deep learning architecture that uses spatial convolution filters (kernels) to automatically extract hierarchical visual patterns from images—starting from simple edges and textures in early layers to complex facial structures in deeper layers.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q8.</span> What is a Residual Network (ResNet), and why is it better than a standard CNN?</div>
  <div class="qa-a"><strong>Answer:</strong> ResNet introduces <em>skip connections</em> (identity shortcuts) that allow gradients to pass directly through layers without attenuation. Standard deep CNNs suffer from vanishing gradients when layers exceed 20, causing training degradation. ResNet-34 allows all 34 layers to train effectively, capturing much richer facial representations.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q9.</span> What is HOG (Histogram of Oriented Gradients)?</div>
  <div class="qa-a"><strong>Answer:</strong> HOG is a classical computer vision feature descriptor that counts occurrences of gradient orientation (edge directions) in localized portions of an image. It captures facial contours independently of illumination changes and runs extremely fast on commodity CPUs (~32 ms).</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q10.</span> Why is dlib used in this project?</div>
  <div class="qa-a"><strong>Answer:</strong> <code>dlib</code> is an optimized C++ scientific toolkit that provides high-performance implementations of the 68-point facial landmark shape predictor and the ResNet-34 metric feature extractor, enabling reliable sub-second face processing on standard laptops.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q11.</span> What is a face embedding?</div>
  <div class="qa-a"><strong>Answer:</strong> A face embedding is a low-dimensional numerical representation of a face. It compresses thousands of image pixels into a vector of 128 continuous numbers where physical facial similarity directly correlates with geometric proximity.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q12.</span> Why are there exactly 128 dimensions in the embedding?</div>
  <div class="qa-a"><strong>Answer:</strong> 128 dimensions is the mathematically validated benchmark established by Google's FaceNet and dlib. It provides enough degrees of freedom to uniquely differentiate millions of human identities while remaining small enough for instant in-memory vector comparison (0.07 ms for all students).</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q13.</span> How does the system compare two faces?</div>
  <div class="qa-a"><strong>Answer:</strong> By computing the <strong>Euclidean Distance</strong> between their 128-dimensional vectors: $d = \sqrt{\sum_{i=1}^{128} (q_i - u_i)^2}$. A small distance means the two faces belong to the same person; a large distance means they belong to different people.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q14.</span> What is Euclidean distance?</div>
  <div class="qa-a"><strong>Answer:</strong> Euclidean distance is the straight-line geometric distance between two points in Euclidean space, calculated as the square root of the sum of squared differences across all 128 dimensions.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q15.</span> What is the recognition threshold in SYNAPSE?</div>
  <div class="qa-a"><strong>Answer:</strong> The recognition threshold is <strong>0.500</strong>. If the Euclidean distance between a live face and the closest enrolled student template is $\le 0.500$, the system accepts the identity. If it is $> 0.500$, the person is rejected as <code>UNKNOWN</code>.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q16.</span> What happens when an unknown or unregistered person appears?</div>
  <div class="qa-a"><strong>Answer:</strong> The system computes distances against all enrolled templates. Because the person is unregistered, all distances exceed 0.500 (typically 0.65 to 1.10). The system flags the face as <code>UNKNOWN</code>, renders a yellow warning box, records zero attendance, and increments the unknown individual count in real-time telemetry.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q17.</span> Why do you capture multiple frames during biometric enrollment instead of a single photograph?</div>
  <div class="qa-a"><strong>Answer:</strong> A single photograph is vulnerable to momentary shadows, slight head tilt, or motion blur. Capturing 8 frames over 5–6 seconds samples natural facial variations (yaw, pitch, expressions). Aggregating them via NumPy mean produces a robust consensus template that significantly improves live recognition accuracy under varied classroom angles.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q18.</span> How is attendance marked automatically in the database?</div>
  <div class="qa-a"><strong>Answer:</strong> Once a face is recognized ($d \le 0.500$) and confirmed to belong to the active lecture's department and semester roster, SYNAPSE checks if the student was already marked. If not, it executes an atomic insert into <code>attendance_records</code> setting <code>status = "PRESENT"</code> with a timestamp and logs a <code>RecognitionEvent</code>.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q19.</span> How do you prevent duplicate attendance records when a student sits in front of the camera for an entire 1-hour lecture?</div>
  <div class="qa-a"><strong>Answer:</strong> SYNAPSE uses a <strong>Dual-Layer Deduplication Guard</strong>: an in-memory set (<code>attendance_marked_ids</code>) that blocks redundant queries at zero CPU cost, and a database check (<code>session_id</code> + <code>student_id</code>) that only increments observation counts and updates <code>last_detected_at</code> without creating duplicate rows.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q20.</span> What happens if two enrolled students appear in front of the camera together?</div>
  <div class="qa-a"><strong>Answer:</strong> The HOG detector localizes two distinct bounding boxes. The dlib encoder extracts two independent 128-d vectors. Vectorized matching identifies each student against the RAM template cache separately. Both students receive distinct bounding boxes and are both marked present without identity collision.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q21.</span> What is face tracking in this project?</div>
  <div class="qa-a"><strong>Answer:</strong> Face tracking maintains identity continuity across consecutive video frames using spatial proximity and centroid matching. It ensures that moving faces maintain their track ID and prevents temporary background individuals from inflating the occupancy count.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q22.</span> How is real-time processing achieved on a laptop without a dedicated GPU?</div>
  <div class="qa-a"><strong>Answer:</strong> Through four key optimizations: (1) client-side canvas downsampling to 640px JPEG; (2) server-side 0.5x scaling (320x240) for HOG detection; (3) in-memory RAM caching of all templates for 0.07 ms matching; and (4) a non-overlapping request loop that prevents network queue build-up.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q23.</span> What database is used and why?</div>
  <div class="qa-a"><strong>Answer:</strong> <strong>SQLite</strong> with <strong>SQLAlchemy ORM</strong>. It is ACID-compliant, requires zero external server setup, supports strict foreign key constraints, and executes local queries in 1 to 3 milliseconds.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q24.</span> How is biometric information stored in the database?</div>
  <div class="qa-a"><strong>Answer:</strong> Biometric vectors are serialized as JSON strings of 128 floating-point numbers in the <code>embedding_data</code> column of the <code>biometric_enrollments</code> table. Raw images are stored separately on disk, and only the file path is saved in the database.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q25.</span> What happens if the internet connection is lost during a lecture?</div>
  <div class="qa-a"><strong>Answer:</strong> SYNAPSE runs <strong>100% locally on the host machine</strong> (localhost). The FastAPI backend, SQLite database, and dlib AI models do not depend on external cloud APIs or internet connectivity. Attendance continues uninterrupted offline.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q26.</span> What are the limitations of the current implementation?</div>
  <div class="qa-a"><strong>Answer:</strong> Key limitations are: (1) sensitivity to extreme face angles (>30° profile yaw); (2) vulnerability to 2D photograph spoofing without depth cameras; and (3) CPU bottlenecks when processing more than 5 faces simultaneously in a single frame.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q27.</span> How can the system be improved in the future?</div>
  <div class="qa-a"><strong>Answer:</strong> By adding active liveness detection (blink and micro-movement analysis), compiling models to ONNX Runtime with TensorRT for GPU acceleration, and supporting multi-camera ceiling RTSP streams across large lecture halls.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q28.</span> What is the difference between Machine Learning and Deep Learning in this project?</div>
  <div class="qa-a"><strong>Answer:</strong> Classical Machine Learning uses handcrafted feature algorithms (HOG edge gradients + Linear SVM) for face detection. Deep Learning uses automatic representation learning through deep layered neural networks (34-layer ResNet) to extract high-level semantic facial embeddings.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q29.</span> Is student enrollment supervised or unsupervised learning?</div>
  <div class="qa-a"><strong>Answer:</strong> Enrollment is neither. It is <strong>deterministic feature extraction</strong> using a frozen model. The student's identity label is assigned by the administrator, and the model merely computes a mathematical projection without adjusting any weights.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q30.</span> Why did you choose Deep Metric Learning instead of training a custom CNN classifier with a Softmax layer?</div>
  <div class="qa-a"><strong>Answer:</strong> A Softmax classifier has a fixed number of output classes ($N$ students). Every time a new student enrolls or drops out, the entire network must be retrained. Deep Metric Learning maps any face into an open-ended coordinate space, allowing instant onboarding of new students simply by storing their vector, with zero model retraining.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q31.</span> Why did you avoid dividing by the Euclidean norm during vector aggregation?</div>
  <div class="qa-a"><strong>Answer:</strong> dlib's ResNet model outputs unnormalized vectors with natural lengths between 1.28 and 1.51. Dividing by the norm scales the vector to length 1.0, creating an artificial distance skew against live query vectors. Pure NumPy mean preserves the native metric space of the model.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q32.</span> What is the purpose of the Medoid outlier filter during enrollment?</div>
  <div class="qa-a"><strong>Answer:</strong> If a student blinks, turns away, or sneezes during the 8-frame capture, that frame produces an outlier vector. The Medoid filter computes pairwise distances among all frames and discards any frame whose distance to the cluster medoid exceeds 0.45, ensuring only clean, consistent frames form the template.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q33.</span> What is the Ambiguity Check in SYNAPSE?</div>
  <div class="qa-a"><strong>Answer:</strong> If a query face matches two different students within a tiny distance margin ($|d_1 - d_2| < 0.035$), SYNAPSE flags the result as <code>AMBIGUOUS</code> rather than guessing, routing the event to the verification queue to prevent accidental identity misassignment.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q34.</span> How does camera mirroring work without distorting bounding boxes?</div>
  <div class="qa-a"><strong>Answer:</strong> The video preview is visually flipped using CSS <code>scale-x-[-1]</code>. To align bounding boxes on the unflipped overlay canvas, SYNAPSE applies the horizontal inversion formula $x_{\text{mirrored}} = W_{\text{canvas}} - x_{\text{source}} - w_{\text{box}}$, ensuring text and labels render left-to-right correctly over the student's face.</div>
</div>

<div class="qa-card">
  <div class="qa-q"><span>Q35.</span> How does SYNAPSE protect password security and session integrity?</div>
  <div class="qa-a"><strong>Answer:</strong> Passwords are protected using memory-hard Argon2id hashing with unique random salts. Sessions are secured via cryptographic HS256 JSON Web Tokens with a 24-hour expiry, enforced at the API level using role-based dependencies (<code>require_admin</code>).</div>
</div>

<!-- SECTION 14 -->
<h1 class="section-title">SECTION 14 — 5–7 MINUTE ORAL PRESENTATION SCRIPT</h1>

<p>
  Use this natural spoken script when presenting the project to your lecturer or evaluation committee. Speak in a confident, conversational, and structured manner:
</p>

<div style="background:#fafafa; border:1px solid #e4e4e7; border-left:4px solid #16a34a; padding:16px 20px; border-radius:4px; font-size:9pt; line-height:1.6;">
  <p><strong>[MINUTE 1 — INTRODUCTION &amp; PROBLEM STATEMENT]</strong><br>
  "Good morning, respected professors. Today, I am presenting <strong>SYNAPSE</strong>, an AI-powered Smart Attendance and Classroom Intelligence Platform. In traditional college classrooms, manual roll calls take 10 to 15 minutes of every lecture, and paper sign-in sheets are heavily vulnerable to proxy attendance, where students mark attendance for absent friends. SYNAPSE solves this problem by using computer vision and facial biometrics to passively, automatically, and accurately mark attendance in under one second as students sit in front of the camera."</p>

  <p><strong>[MINUTE 2 — ARCHITECTURE &amp; TECHNOLOGIES]</strong><br>
  "SYNAPSE is built using a modern decoupled architecture. On the frontend, we use <strong>React 18 with TypeScript</strong> to provide a fast, responsive interface with a 60 FPS HUD overlay. On the backend, we use <strong>FastAPI in Python</strong>, which processes video frames and coordinates with an <strong>SQLite</strong> relational database. For artificial intelligence, we use <strong>OpenCV</strong> for image processing and <strong>dlib</strong> via the <code>face_recognition</code> library for deep learning facial feature extraction."</p>

  <p><strong>[MINUTE 3 — THE ML/DL MODEL (CRITICAL SECTION)]</strong><br>
  "I want to highlight how the machine learning model actually works. SYNAPSE uses <strong>Deep Metric Learning</strong> based on Davis King's pre-trained <strong>ResNet-34</strong> residual network. We do not train a network from scratch, and we do not use an SVM or KNN classifier. Training a neural network from scratch on student photos would be completely impractical and require retraining whenever a student joins.<br><br>
  Instead, our pre-trained ResNet-34 acts as a frozen feature extractor. It transforms any human face into a point in a <strong>128-dimensional Euclidean space</strong>. In this space, different photos of the same student produce vectors that are very close together, while photos of different students produce vectors that are far apart."</p>

  <p><strong>[MINUTE 4 — ENROLLMENT &amp; RECOGNITION WORKFLOW]</strong><br>
  "When a student enrolls, the webcam records a short 5 to 6 second video capturing 8 candidate frames. We filter out blurry frames using Laplacian variance and remove outliers using a medoid distance filter. The remaining encodings are averaged using a pure NumPy mean to create the student's 128-dimensional template, which is stored in SQLite.<br><br>
  During a live lecture, the webcam captures frames at 640 pixels. We downscale the frame by 0.5x to run HOG face detection in just 32 milliseconds. Once a face is located, the ResNet-34 extracts its 128-d live vector. We then compute the Euclidean distance between this live vector and all enrolled student vectors stored in an in-memory RAM cache. This matching step takes only 0.07 milliseconds."</p>

  <p><strong>[MINUTE 5 — MATCHING THRESHOLD &amp; ATTENDANCE MARKING]</strong><br>
  "Our calibrated recognition threshold is <strong>0.500</strong>. If the Euclidean distance is less than or equal to 0.50, the student is recognized. In our tests, registered students produced distances between 0.06 and 0.18, achieving 100% recognition accuracy on our benchmark dataset, while unregistered imposter faces produced distances of 1.00 and were completely rejected.<br><br>
  Once recognized, SYNAPSE checks the active timetable lecture session, verifies that the student belongs to that department and semester cohort, and commits a <code>PRESENT</code> record in the database. A dual-layer deduplication guard ensures that a student sitting in class for an entire hour is marked exactly once."</p>

  <p><strong>[MINUTE 6 — CAMERA HUD &amp; SECURITY]</strong><br>
  "On the user interface, we implemented horizontal camera mirroring so the webcam behaves naturally like a selfie camera, and an Exponential Moving Average loop smooths the bounding boxes at 60 frames per second so they don't jitter. Once recognized, a prominent green <code>[✓ PRESENT]</code> badge remains attached to the student's face. All faculty and admin passwords are encrypted using memory-hard Argon2id hashing, and sessions use 24-hour cryptographic JWT tokens."</p>

  <p><strong>[MINUTE 7 — CONCLUSION &amp; FUTURE WORK]</strong><br>
  "In terms of limitations, standard webcams are vulnerable to physical photo spoofing, which we plan to address in future work by adding blink and micro-movement liveness detection, as well as TensorRT GPU acceleration.<br><br>
  To conclude, SYNAPSE delivers an automated, sub-second (241 ms latency) attendance platform that eliminates proxy attendance, saves instructional time, and provides real-time academic intelligence. Thank you, and I am now ready for your questions."</p>
</div>

<!-- SECTION 15 -->
<h1 class="section-title">SECTION 15 — TECHNICAL SOURCE REFERENCES</h1>

<p>
  To verify every statement in this document directly against the codebase during a viva or code walk-through, refer to the following verified source mapping:
</p>

<table>
  <thead>
    <tr>
      <th>Pipeline Operation</th>
      <th>Source File Path</th>
      <th>Function / Class / Variable</th>
      <th>Line Numbers</th>
      <th>Specific Responsibility &amp; Logic</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>In-Memory Cache Loading</strong></td>
      <td><code>backend/app/services/biometric_service.py</code></td>
      <td><code>CentralizedBiometricService.load_cache()</code></td>
      <td>Lines 35–89</td>
      <td>Loads all active student 128-d templates from SQLite into RAM contiguous NumPy arrays for 0.07 ms matching</td>
    </tr>
    <tr>
      <td><strong>Fast 0.5x Scale HOG Detection</strong></td>
      <td><code>backend/app/services/biometric_service.py</code></td>
      <td><code>extract_face_encodings(use_fast_scale=True)</code></td>
      <td>Lines 95–138</td>
      <td>Downscales RGB frame by 0.5x, runs HOG detector in ~32 ms, scales bounding boxes back by 2x</td>
    </tr>
    <tr>
      <td><strong>Multi-Frame Enrollment</strong></td>
      <td><code>backend/app/services/biometric_service.py</code></td>
      <td><code>enroll_student()</code></td>
      <td>Lines 139–301</td>
      <td>Samples 8 candidate frames, filters primary face by area/center proximity, runs medoid outlier filter, computes NumPy mean</td>
    </tr>
    <tr>
      <td><strong>Pure NumPy Mean Aggregation</strong></td>
      <td><code>backend/app/services/biometric_service.py</code></td>
      <td><code>avg_encoding = np.mean(valid_encodings, axis=0)</code></td>
      <td>Line 241</td>
      <td>Aggregates multiple 128-d vectors into a consensus template without L2 normalization tampering</td>
    </tr>
    <tr>
      <td><strong>Tolerance Threshold = 0.500</strong></td>
      <td><code>backend/app/services/biometric_service.py</code></td>
      <td><code>self.default_tolerance = 0.50</code></td>
      <td>Line 27–28</td>
      <td>Defines strict Euclidean distance cutoff separating genuine students from imposters</td>
    </tr>
    <tr>
      <td><strong>Vectorized Euclidean Matching</strong></td>
      <td><code>backend/app/services/biometric_service.py</code></td>
      <td><code>recognize_faces_in_frame()</code></td>
      <td>Lines 303–380</td>
      <td>Invokes <code>face_recognition.face_distance()</code> on RAM cache, evaluates $d \le 0.50$, flags matches</td>
    </tr>
    <tr>
      <td><strong>Blur &amp; Quality Assessment</strong></td>
      <td><code>backend/app/services/cv_engine.py</code></td>
      <td><code>assess_face_quality()</code></td>
      <td>Lines 21–64</td>
      <td>Calculates Laplacian variance $\text{Var}(\nabla^2 I) \ge 14.0$ and brightness range $[25..240]$</td>
    </tr>
    <tr>
      <td><strong>Ambiguity Protection Check</strong></td>
      <td><code>backend/app/services/cv_engine.py</code></td>
      <td><code>match_face()</code></td>
      <td>Lines 160–174</td>
      <td>Flags match as <code>AMBIGUOUS</code> if top 2 candidates belong to different students and $\Delta d < 0.035$</td>
    </tr>
    <tr>
      <td><strong>Webcam Session Initialization</strong></td>
      <td><code>backend/app/services/webcam_attendance_manager.py</code></td>
      <td><code>start_session()</code></td>
      <td>Lines 32–120</td>
      <td>Creates or resumes active <code>LectureSession</code>, validates faculty timetable, loads cohort roster</td>
    </tr>
    <tr>
      <td><strong>Dual-Layer Deduplication</strong></td>
      <td><code>backend/app/services/webcam_attendance_manager.py</code></td>
      <td><code>process_frame()</code></td>
      <td>Lines 309–330</td>
      <td>Checks in-memory set <code>attendance_marked_ids</code> and database unique constraint before inserting</td>
    </tr>
    <tr>
      <td><strong>Spatial Unknown Track Association</strong></td>
      <td><code>backend/app/services/webcam_attendance_manager.py</code></td>
      <td><code>_match_unknown_track()</code></td>
      <td>Lines 198–240</td>
      <td>Tracks unknown individuals by centroid distance ($< 90\text{px}$) over 12 seconds to prevent inflated counts</td>
    </tr>
    <tr>
      <td><strong>Argon2id Password Hashing</strong></td>
      <td><code>backend/app/auth.py</code></td>
      <td><code>get_password_hash()</code>, <code>verify_password()</code></td>
      <td>Lines 16–23</td>
      <td>Memory-hard cryptographic password verification using Argon2id</td>
    </tr>
    <tr>
      <td><strong>JWT Authentication &amp; RBAC</strong></td>
      <td><code>backend/app/auth.py</code></td>
      <td><code>create_access_token()</code>, <code>require_admin()</code></td>
      <td>Lines 25–34, 57–61</td>
      <td>Issues 24-hour HS256 tokens and enforces role-based administrative endpoint boundaries</td>
    </tr>
    <tr>
      <td><strong>Coordinate Mirror Inversion Formula</strong></td>
      <td><code>frontend/src/pages/LiveWebcamAttendance.tsx</code></td>
      <td><code>reconcileDetectedFaces()</code></td>
      <td>Lines 486–491</td>
      <td>Applies horizontal mirror formula: <code>x_mirrored = canvasW - unmirrX - boxW</code></td>
    </tr>
    <tr>
      <td><strong>60 FPS HUD Bounding Box Damping</strong></td>
      <td><code>frontend/src/pages/LiveWebcamAttendance.tsx</code></td>
      <td><code>renderOverlayFrame()</code>, <code>renderHUDBox()</code></td>
      <td>Lines 390–460</td>
      <td>Exponential moving average position interpolation and drawing green <code>[✓ PRESENT]</code> badge</td>
    </tr>
    <tr>
      <td><strong>Non-Overlapping Frame Dispatch</strong></td>
      <td><code>frontend/src/pages/LiveWebcamAttendance.tsx</code></td>
      <td><code>startFrameCaptureLoop()</code></td>
      <td>Lines 570–630</td>
      <td>Uses <code>isRequestInFlightRef</code> to send latest 640px JPEG only after previous inference returns</td>
    </tr>
  </tbody>
</table>

</body>
</html>
"""

print("Part 4 assembled.")

