document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const captchaError = document.getElementById('captchaError');
    const passwordLoginForm = document.getElementById('passwordLoginForm');
    const mfaVerificationForm = document.getElementById('mfaVerificationForm');
    const emailVerification = document.getElementById('emailVerification');
    const totpVerification = document.getElementById('totpVerification');
    const useTotp = document.getElementById('useTotp');
    const useEmail = document.getElementById('useEmail');
    const backToLogin = document.getElementById('backToLogin');
    const emailForm = document.getElementById('emailForm');
    const resendCode = document.getElementById('resendCode');
    
    let currentUserId = null;

    // Toggle password visibility
    togglePassword.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePassword.textContent = type === 'password' ? 'Show' : 'Hide';
    });

    // Switch between MFA methods
    useTotp.addEventListener('click', function() {
        totpVerification.style.display = 'block';
        emailVerification.style.display = 'none';
        useTotp.classList.add('active');
        useEmail.classList.remove('active');
    });

    useEmail.addEventListener('click', function() {
        totpVerification.style.display = 'none';
        emailVerification.style.display = 'block';
        useTotp.classList.remove('active');
        useEmail.classList.add('active');
    });

    // Back to login
    backToLogin.addEventListener('click', function(e) {
        e.preventDefault();
        passwordLoginForm.style.display = 'block';
        mfaVerificationForm.style.display = 'none';
    });

    // Handle initial login form submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get reCAPTCHA response
        const captchaResponse = grecaptcha.getResponse();
        
        if (!captchaResponse) {
            captchaError.textContent = 'Please complete the CAPTCHA verification.';
            captchaError.classList.add('visible');
            return;
        }

        // Clear any previous error
        captchaError.classList.remove('visible');
        
        const email = document.getElementById('email').value;
        const password = passwordInput.value;
        
        try {
            const response = await fetch('http://192.168.1.4:5000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, captchaResponse })
            });

            const data = await response.json();

            if (response.ok) {
                if (data.requiresVerification) {
                    // Store user ID for verification
                    currentUserId = data.userId;
                    
                    // Show MFA verification form
                    passwordLoginForm.style.display = 'none';
                    mfaVerificationForm.style.display = 'block';
                    
                    // Default to email verification
                    totpVerification.style.display = 'none';
                    emailVerification.style.display = 'block';
                    useTotp.classList.remove('active');
                    useEmail.classList.add('active');
                    
                    alert('Verification code has been sent to your email');
                } else {
                    // Store JWT token
                    localStorage.setItem('token', data.token); 
                    alert('Login successful! Redirecting...');
                    window.location.href = data.redirect;
                }
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Login failed:', error);
            alert('An error occurred. Please try again.');
        }
    });

    // Handle email verification form submission
    emailForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const verificationCode = document.getElementById('emailCode').value;
        
        if (!verificationCode) {
            alert('Please enter the verification code');
            return;
        }
        
        try {
            const response = await fetch('http://192.168.1.4:5000/verify-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: currentUserId,
                    code: verificationCode 
                })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Verification successful! Redirecting...');
                window.location.href = data.redirect;
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Verification failed:', error);
            alert('An error occurred. Please try again.');
        }
    });

    // Handle resend code button
    resendCode.addEventListener('click', async function() {
        if (!currentUserId) {
            alert('Please go back and log in again');
            return;
        }
        
        try {
            const response = await fetch('http://192.168.1.4:5000/resend-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId })
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message);
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Failed to resend code:', error);
            alert('An error occurred. Please try again.');
        }
    });
});