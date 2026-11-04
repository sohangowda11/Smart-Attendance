from .auth import Token, TokenData, UserLogin, UserCreate, UserUpdate, UserOut
from .academic import DepartmentCreate, DepartmentOut, ClassroomCreate, ClassroomOut, SubjectCreate, SubjectOut
from .student import StudentCreate, StudentUpdate, StudentOut, BiometricEnrollmentOut
from .timetable import TimetableCreate, TimetableOut, LectureSessionCreate, LectureSessionOut
from .camera import CameraCreate, CameraUpdate, CameraOut, CameraHealthOut
from .attendance import AttendanceRecordOut, AttendanceCorrection, VerificationQueueItem, VerificationAction
from .analytics import DashboardStats, TrendPoint, SubjectAttendance, ShortageStudent, ClassroomOccupancy
from .settings import SettingItem, SettingUpdate, AuditLogOut, NotificationOut

