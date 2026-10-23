use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll, Waker};

struct Shared<T> {
    result: Option<T>,
    waker: Option<Waker>,
}

/// Future that resolves when a closure running on its own OS thread returns.
pub struct ThreadTask<T>(Arc<Mutex<Shared<T>>>);

/// Runs `work` on a new thread so a long import doesn't hold the caller's
/// (the JS) thread. No async runtime needed, the thread wakes the future.
pub fn run_on_thread<T: Send + 'static>(work: impl FnOnce() -> T + Send + 'static) -> ThreadTask<T> {
    let shared = Arc::new(Mutex::new(Shared { result: None, waker: None }));
    let for_thread = shared.clone();
    std::thread::spawn(move || {
        let result = work();
        let mut state = for_thread.lock().unwrap();
        state.result = Some(result);
        if let Some(waker) = state.waker.take() {
            waker.wake();
        }
    });
    ThreadTask(shared)
}

impl<T> Future for ThreadTask<T> {
    type Output = T;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<T> {
        let mut state = self.0.lock().unwrap();
        match state.result.take() {
            Some(result) => Poll::Ready(result),
            None => {
                state.waker = Some(cx.waker().clone());
                Poll::Pending
            }
        }
    }
}
