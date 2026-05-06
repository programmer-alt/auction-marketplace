import { useState, useCallback } from 'react';
import { bidsApi } from '../../../api/bids';
import toast from 'react-hot-toast';
import type { 
  AsyncState, 
  FormFieldState,
  Bid 
} from '../../../types/advanced';
