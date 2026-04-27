"""
models/gru_model.py
GRU (Gated Recurrent Unit) — cepat, ringan, cocok untuk data monthly yang relatif smooth.
Input : (batch, window_size, 1)
Output: (batch, horizon)
"""
import torch
import torch.nn as nn


class GRUForecaster(nn.Module):
    def __init__(
        self,
        input_size:  int = 1,
        hidden_size: int = 64,
        num_layers:  int = 2,
        dropout:     float = 0.2,
        horizon:     int = 1,
    ):
        super().__init__()
        self.gru = nn.GRU(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(hidden_size, horizon)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, seq, input_size)
        out, _ = self.gru(x)          # out: (batch, seq, hidden)
        out = self.dropout(out[:, -1, :])  # ambil timestep terakhir
        return self.fc(out)           # (batch, horizon)
