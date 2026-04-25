interface ToastProps {
  show: boolean;
  message: string;
}

export default function Toast({ show, message }: ToastProps) {
  return (
    <div className={`save-toast ${show ? "show" : ""}`}>
      {message}
    </div>
  );
}
