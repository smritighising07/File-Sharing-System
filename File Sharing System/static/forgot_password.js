// Create this as static/forgot_password.js
document.addEventListener('DOMContentLoaded', function() {
    const requestResetForm = document.getElementById('requestResetForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const passwordResetRequestForm = document.getElementById('passwordResetRequestForm');
    const newPasswordForm = document.getElementById('newPasswordForm');
    const toggleNewPassword = document.getElementById('toggleNewPassword');
    const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    
    // Check if we're on the reset page with token
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');
    
    if (resetToken) {
        // We're on the reset form page
        document.getElementById('resetToken').value = resetToken;
        requestResetForm.style.display = 'none';
        resetPasswordForm.style.display = 'block';
    }
    
    // Toggle password visibility functions
    if (toggleNewPassword) {
        toggleNewPassword.addEventListener('click', function() {
            const type = newPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            newPasswordInput.setAttribute('type', type);
            toggleNewPassword.textContent = type === 'password' ? 'Show' : 'Hide';
        });
    }
    
    if (toggleConfirmPassword) {
        toggleConfirmPassword.addEventListener('click', function() {
            const type = confirmPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            confirmPasswordInput.setAttribute('type', type);
            toggleConfirmPassword.textContent = type === 'password' ? 'Show' : 'Hide';
        });
    }
    
    // Handle password reset request form submission
    if (passwordResetRequestForm) {
        passwordResetRequestForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('resetEmail').value;
            
            try {
                const response = await fetch('/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Password reset instructions have been sent to your email.');
                } else {
                    alert(data.error || 'An error occurred. Please try again.');
                }
            } catch (error) {
                console.error('Reset request failed:', error);
                alert('An error occurred. Please try again.');
            }
        });
    }
    
    // Handle new password form submission
    if (newPasswordForm) {
        newPasswordForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const token = document.getElementById('resetToken').value;
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            
            // Validate password match
            if (newPassword !== confirmPassword) {
                alert('Passwords do not match.');
                return;
            }
            
            try {
                const response = await fetch('/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, password: newPassword })
                });

                const data = await response.json();

                if (response.ok) {
                    alert('Your password has been reset successfully!');
                    window.location.href = '/login';
                } else {
                    alert(data.error || 'An error occurred. Please try again.');
                }
            } catch (error) {
                console.error('Password reset failed:', error);
                alert('An error occurred. Please try again.');
            }
        });
    }
});